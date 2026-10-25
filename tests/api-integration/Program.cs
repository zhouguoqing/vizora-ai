using Npgsql;

var connection = Environment.GetEnvironmentVariable("TEST_DB_CONNECTION") ??
    throw new InvalidOperationException("Set TEST_DB_CONNECTION to an isolated test database");
var settings = new NpgsqlConnectionStringBuilder(connection);
if (!settings.Database!.StartsWith("vizora_test", StringComparison.Ordinal))
    throw new InvalidOperationException("Only a dedicated vizora_test* database is allowed");
await using var db = new NpgsqlConnection(connection);
try { await db.OpenAsync(); }
catch (PostgresException ex) when (ex.SqlState == "3D000" && args.FirstOrDefault() == "sql")
{
    var databaseName = settings.Database;
    settings.Database = "postgres";
    await using var admin = new NpgsqlConnection(settings.ConnectionString);
    await admin.OpenAsync();
    await using var create = new NpgsqlCommand("CREATE DATABASE \"" + databaseName.Replace("\"", "\"\"") + "\"", admin);
    await create.ExecuteNonQueryAsync();
    await db.OpenAsync();
}
if (args.FirstOrDefault() == "sql")
{
    var sql = args.Length > 1 ? await File.ReadAllTextAsync(args[1]) : await Console.In.ReadToEndAsync();
    await using var command = new NpgsqlCommand(sql, db);
    await command.ExecuteNonQueryAsync();
    Console.WriteLine("SQL applied to isolated test database");
    return;
}
if (args.FirstOrDefault() == "commerce")
{
    await CommerceRegression.Run(connection, db);
    return;
}
Console.WriteLine("Integration runner initialized");
