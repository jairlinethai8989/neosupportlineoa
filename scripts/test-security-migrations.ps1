param(
  [string]$PostgresImage = 'postgres:17-alpine',
  [ValidateSet('chronological', 'production-rollout')]
  [string]$MigrationOrder = 'chronological'
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$repositoryRoot = Split-Path -Parent $PSScriptRoot
$containerName = 'neo-security-test-' + [Guid]::NewGuid().ToString('N').Substring(0, 12)
$containerStarted = $false

function Invoke-SecuritySqlFile {
  param([Parameter(Mandatory = $true)][string]$RelativePath)

  $absolutePath = Join-Path $repositoryRoot $RelativePath
  if (-not (Test-Path -LiteralPath $absolutePath -PathType Leaf)) {
    throw "Required SQL file is missing: $absolutePath"
  }

  Write-Host "Applying $RelativePath"
  Get-Content -Raw -LiteralPath $absolutePath |
    docker exec -i $containerName psql -X -v ON_ERROR_STOP=1 -U postgres -d postgres
  if ($LASTEXITCODE -ne 0) {
    throw "SQL execution failed: $RelativePath"
  }
}

try {
  $containerId = docker run --rm -d --name $containerName -e POSTGRES_PASSWORD=postgres $PostgresImage
  if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($containerId)) {
    throw 'Unable to start the disposable PostgreSQL container.'
  }
  $containerStarted = $true

  $databaseReady = $false
  $consecutiveReadyChecks = 0
  # Docker Desktop cold starts can spend more than 30 seconds initializing the
  # disposable cluster on Windows; poll in short intervals with a bounded cap.
  for ($attempt = 1; $attempt -le 120; $attempt++) {
    $previousErrorActionPreference = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    docker exec $containerName psql -X -U postgres -d postgres -tAc 'select 1' *> $null
    $readyExitCode = $LASTEXITCODE
    $ErrorActionPreference = $previousErrorActionPreference
    if ($readyExitCode -eq 0) {
      $consecutiveReadyChecks++
      if ($consecutiveReadyChecks -ge 3) {
        $databaseReady = $true
        break
      }
    } else {
      $consecutiveReadyChecks = 0
    }
    Start-Sleep -Seconds 1
  }
  if (-not $databaseReady) {
    throw 'Disposable PostgreSQL did not become ready within 120 seconds.'
  }

  $bootstrapFiles = @(
    'supabase/tests/bootstrap_disposable.sql',
    'baseline_schema.sql',
    'add_staff_evaluations_table.sql',
    'add_evaluation_360_schema.sql',
    'add_secure_handoff_schema.sql',
    'supabase/tests/portal_production_policy_compatibility.sql'
  )

  $chronologicalMigrations = @(
    'supabase/migrations/202608100000_private_chat_media_bucket.sql',
    'supabase/migrations/202608100001_portal_rls_lockdown.sql',
    'supabase/tests/portal_rls_stage_one.sql',
    'supabase/migrations/202608100002_handoff_access_hardening.sql',
    'supabase/migrations/202608100003_handoff_rls_lockdown.sql',
    'supabase/migrations/202608100004_profile_update_hardening.sql',
    'supabase/migrations/202608100005_profile_update_lockdown.sql',
    'supabase/migrations/202608100006_company_settings_secret_lockdown.sql',
    'supabase/migrations/202608100007_sla_rules_permission_lockdown.sql',
    'supabase/migrations/202608100008_system_logs_permission_lockdown.sql',
    'supabase/migrations/202608100009_ticket_logs_staff_lockdown.sql',
    'supabase/migrations/202608100010_system_logs_server_write_only.sql',
    'supabase/migrations/202608100011_staff_evaluations_server_only.sql',
    'supabase/migrations/202608100012_messages_media_columns.sql'
  )

  $productionRolloutMigrations = @(
    'supabase/migrations/202608100000_private_chat_media_bucket.sql',
    'supabase/migrations/202608100002_handoff_access_hardening.sql',
    'supabase/migrations/202608100004_profile_update_hardening.sql',
    'supabase/migrations/202608100001_portal_rls_lockdown.sql',
    'supabase/tests/portal_rls_stage_one.sql',
    'supabase/migrations/202608100005_profile_update_lockdown.sql',
    'supabase/migrations/202608100006_company_settings_secret_lockdown.sql',
    'supabase/migrations/202608100007_sla_rules_permission_lockdown.sql',
    'supabase/migrations/202608100008_system_logs_permission_lockdown.sql',
    'supabase/migrations/202608100009_ticket_logs_staff_lockdown.sql',
    'supabase/migrations/202608100010_system_logs_server_write_only.sql',
    'supabase/migrations/202608100003_handoff_rls_lockdown.sql',
    'supabase/tests/staff_evaluations_production_compatibility.sql',
    'supabase/migrations/202608100011_staff_evaluations_server_only.sql',
    'supabase/tests/messages_production_compatibility.sql',
    'supabase/migrations/202608100012_messages_media_columns.sql'
  )

  $verificationFiles = @(
    'supabase/tests/portal_rls_lockdown.sql',
    'supabase/tests/portal_rls_policy_matrix.sql',
    'supabase/tests/handoff_access_hardening.sql',
    'supabase/tests/company_settings_secret_lockdown.sql',
    'supabase/tests/sla_rules_permission_lockdown.sql',
    'supabase/tests/system_logs_permission_lockdown.sql',
    'supabase/tests/ticket_logs_staff_lockdown.sql',
    'supabase/tests/staff_evaluations_server_only.sql',
    'supabase/tests/messages_media_columns.sql'
  )

  $migrationFiles = if ($MigrationOrder -eq 'production-rollout') {
    $productionRolloutMigrations
  } else {
    $chronologicalMigrations
  }

  $expectedMigrationVersions = 0..12 | ForEach-Object { '20260810' + $_.ToString('0000') }
  $actualMigrationVersions = $migrationFiles |
    Where-Object { $_ -like 'supabase/migrations/*' } |
    ForEach-Object {
    $fileName = [IO.Path]::GetFileName($_)
    if ($fileName -notmatch '^(\d{12})_') {
      throw "Migration filename does not start with a 12-digit version: $fileName"
    }
    $Matches[1]
    }
  if (($actualMigrationVersions | Select-Object -Unique).Count -ne $actualMigrationVersions.Count) {
    throw "Migration order '$MigrationOrder' contains duplicate versions."
  }
  if (Compare-Object ($expectedMigrationVersions | Sort-Object) ($actualMigrationVersions | Sort-Object)) {
    throw "Migration order '$MigrationOrder' does not contain exactly versions 202608100000 through 202608100012."
  }

  $sqlFiles = @($bootstrapFiles) + @($migrationFiles) + @($verificationFiles)

  foreach ($sqlFile in $sqlFiles) {
    Invoke-SecuritySqlFile -RelativePath $sqlFile
  }

  Write-Host 'Security migration checks passed in the disposable database.'
}
finally {
  if ($containerStarted -and $containerName -match '^neo-security-test-[0-9a-f]{12}$') {
    docker rm -f -- $containerName *> $null
  }
}
