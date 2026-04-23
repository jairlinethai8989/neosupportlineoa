/* eslint-disable @typescript-eslint/no-require-imports */
const dotenv = require('dotenv');
const { createClient } = require('@supabase/supabase-js');
const line = require('@line/bot-sdk');

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const lineChannelAccessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN;
const lineChannelSecret = process.env.LINE_CHANNEL_SECRET;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('Missing Supabase env vars. Check NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
}

if (!lineChannelAccessToken || !lineChannelSecret) {
  throw new Error('Missing LINE env vars. Check LINE_CHANNEL_ACCESS_TOKEN and LINE_CHANNEL_SECRET.');
}

const supabase = createClient(supabaseUrl, serviceRoleKey);
const lineClient = new line.Client({
  channelAccessToken: lineChannelAccessToken,
  channelSecret: lineChannelSecret,
});

function parseArgs(argv) {
  const args = {
    dryRun: false,
    limit: null,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === '--dry-run') {
      args.dryRun = true;
      continue;
    }

    if (arg === '--limit') {
      const nextValue = argv[index + 1];
      if (!nextValue) {
        throw new Error('Expected a numeric value after --limit');
      }

      args.limit = Number.parseInt(nextValue, 10);
      if (Number.isNaN(args.limit) || args.limit <= 0) {
        throw new Error(`Invalid --limit value: ${nextValue}`);
      }

      index += 1;
    }
  }

  return args;
}

function needsBackfill(customer) {
  const displayName = typeof customer.display_name === 'string' ? customer.display_name.trim() : '';
  return !displayName || displayName.toLowerCase() === 'line user';
}

async function fetchTargetCustomers(limit) {
  let query = supabase
    .from('customers')
    .select('id, line_user_id, display_name')
    .not('line_user_id', 'is', null)
    .order('updated_at', { ascending: true, nullsFirst: true });

  if (limit) {
    query = query.limit(limit);
  }

  const { data, error } = await query;
  if (error) {
    throw error;
  }

  return (data || []).filter(needsBackfill);
}

async function detectCustomerAvatarColumn() {
  const { data, error } = await supabase
    .from('customers')
    .select('*')
    .limit(1);

  if (error) {
    throw error;
  }

  const sampleRow = Array.isArray(data) ? data[0] : null;
  return Boolean(sampleRow && Object.prototype.hasOwnProperty.call(sampleRow, 'avatar_url'));
}

async function getLineProfile(lineUserId) {
  try {
    const profile = await lineClient.getProfile(lineUserId);
    return {
      ok: true,
      displayName: profile.displayName || null,
      pictureUrl: profile.pictureUrl || null,
    };
  } catch (error) {
    return {
      ok: false,
      error,
    };
  }
}

async function updateCustomer(customerId, profile, dryRun, options) {
  const payload = {
    display_name: profile.displayName,
    updated_at: new Date().toISOString(),
  };

  if (options.hasAvatarColumn) {
    payload.avatar_url = profile.pictureUrl;
  }

  if (dryRun) {
    return { updated: false, payload };
  }

  const { error } = await supabase
    .from('customers')
    .update(payload)
    .eq('id', customerId);

  if (error) {
    throw error;
  }

  return { updated: true, payload };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const hasAvatarColumn = await detectCustomerAvatarColumn();
  const candidates = await fetchTargetCustomers(args.limit);

  console.log(`Found ${candidates.length} customer(s) needing LINE profile backfill.`);
  console.log(`Schema check: avatar_url column ${hasAvatarColumn ? 'detected' : 'not detected'}, display_name sync enabled.`);
  if (candidates.length === 0) {
    return;
  }

  let updatedCount = 0;
  let skippedCount = 0;
  let failedCount = 0;

  for (const customer of candidates) {
    const lineUserId = customer.line_user_id;

    if (!lineUserId) {
      skippedCount += 1;
      console.log(`- skip ${customer.id}: missing line_user_id`);
      continue;
    }

    const profileResult = await getLineProfile(lineUserId);
    if (!profileResult.ok) {
      failedCount += 1;
      const errorMessage =
        profileResult.error instanceof Error
          ? profileResult.error.message
          : JSON.stringify(profileResult.error);
      console.log(`- fail ${customer.id}: could not fetch LINE profile for ${lineUserId} (${errorMessage})`);
      continue;
    }

    if (!profileResult.displayName) {
      skippedCount += 1;
      console.log(`- skip ${customer.id}: LINE profile has empty displayName`);
      continue;
    }

    const result = await updateCustomer(customer.id, profileResult, args.dryRun, {
      hasAvatarColumn,
    });
    updatedCount += 1;

    const action = args.dryRun ? 'would update' : 'updated';
    console.log(
      `- ${action} ${customer.id}: "${customer.display_name || '(empty)'}" -> "${result.payload.display_name}"`
    );
  }

  console.log('');
  console.log(`Summary: updated=${updatedCount}, skipped=${skippedCount}, failed=${failedCount}, dryRun=${args.dryRun}`);
}

main().catch((error) => {
  console.error('Backfill failed:', error);
  process.exitCode = 1;
});
