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
    dryRun: true,
    confirm: false,
    limit: null,
    onlyIds: [],
    onlyLineIds: [],
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === '--dry-run') {
      args.dryRun = true;
      continue;
    }

    if (arg === '--apply') {
      args.dryRun = false;
      continue;
    }

    if (arg === '--confirm') {
      args.confirm = true;
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
      continue;
    }

    if (arg === '--only-ids') {
      const nextValue = argv[index + 1];
      if (!nextValue) {
        throw new Error('Expected comma-separated IDs after --only-ids');
      }
      args.onlyIds = nextValue
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);
      index += 1;
      continue;
    }

    if (arg === '--only-line-ids') {
      const nextValue = argv[index + 1];
      if (!nextValue) {
        throw new Error('Expected comma-separated line_user_id values after --only-line-ids');
      }
      args.onlyLineIds = nextValue
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);
      index += 1;
      continue;
    }
  }

  if (!args.dryRun && !args.confirm) {
    throw new Error('Apply mode requires --confirm for safety.');
  }

  return args;
}

function needsBackfill(customer) {
  const displayName = typeof customer.display_name === 'string' ? customer.display_name.trim() : '';
  return !displayName || displayName.toLowerCase() === 'line user';
}

async function fetchTargetCustomers(limit, filters) {
  let query = supabase
    .from('customers')
    .select('id, line_user_id, display_name, metadata')
    .not('line_user_id', 'is', null)
    .order('updated_at', { ascending: true, nullsFirst: true });

  if (limit) {
    query = query.limit(limit);
  }

  const { data, error } = await query;
  if (error) {
    throw error;
  }

  const rows = (data || []).filter(needsBackfill);
  return rows.filter((row) => {
    if (filters.onlyIds.length > 0 && !filters.onlyIds.includes(row.id)) return false;
    if (filters.onlyLineIds.length > 0 && !filters.onlyLineIds.includes(row.line_user_id)) return false;
    return true;
  });
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

async function updateCustomer(customer, profile, dryRun, options) {
  const currentMetadata =
    customer && typeof customer.metadata === 'object' && customer.metadata !== null
      ? customer.metadata
      : {};

  const payload = {
    display_name: profile.displayName,
    metadata: {
      ...currentMetadata,
      line_profile: {
        display_name: profile.displayName,
        picture_url: profile.pictureUrl,
        synced_at: new Date().toISOString(),
      },
    },
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
    .eq('id', customer.id);

  if (error) {
    throw error;
  }

  return { updated: true, payload };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const hasAvatarColumn = await detectCustomerAvatarColumn();
  const candidates = await fetchTargetCustomers(args.limit, {
    onlyIds: args.onlyIds,
    onlyLineIds: args.onlyLineIds,
  });

  console.log(`Found ${candidates.length} customer(s) needing LINE profile backfill.`);
  console.log(`Schema check: avatar_url column ${hasAvatarColumn ? 'detected' : 'not detected'}, display_name sync enabled.`);
  console.log(`Mode: ${args.dryRun ? 'PREVIEW' : 'APPLY'}${args.dryRun ? '' : ' (confirmed)'}`);
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

    const result = await updateCustomer(customer, profileResult, args.dryRun, {
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
