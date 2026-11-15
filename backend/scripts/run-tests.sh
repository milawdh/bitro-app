#!/bin/sh
set -eu

#region Integration environment
export BITRO_TEST_DB_CONNECTION_STRING="${BITRO_TEST_DB_CONNECTION_STRING:-${BITRO_DB_CONNECTION_STRING:-}}"
export BITRO_TEST_REDIS_CONNECTION_STRING="${BITRO_TEST_REDIS_CONNECTION_STRING:-${BITRO_REDIS_CONNECTION_STRING:-}}"
#endregion

#region Test execution
exec dotnet vstest tests/BitroLearn.Api.Tests/bin/Release/net10.0/BitroLearn.Api.Tests.dll \
  '--logger:console;verbosity=minimal' '--logger:trx;LogFileName=backend.trx' \
  --ResultsDirectory:artifacts/test-results
#endregion
