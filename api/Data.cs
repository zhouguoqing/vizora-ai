using Npgsql;
namespace Vizora;
public sealed class Db(IConfiguration config)
{
 public async Task<NpgsqlConnection> Open(CancellationToken ct=default){var c=new NpgsqlConnection(config.GetConnectionString("Main"));try{await c.OpenAsync(ct);return c;}catch{await c.DisposeAsync();throw;}}
 public static NpgsqlCommand Cmd(NpgsqlConnection c,string sql,params (string,object?)[] args){var cmd=new NpgsqlCommand(sql,c);foreach(var (key,val) in args)cmd.Parameters.AddWithValue(key,val??DBNull.Value);return cmd;}
 public static async Task<Dictionary<string,object?>?> One(NpgsqlConnection c,string sql,params (string,object?)[] args){await using var cmd=Cmd(c,sql,args);await using var r=await cmd.ExecuteReaderAsync();if(!await r.ReadAsync())return null;var d=new Dictionary<string,object?>();for(var i=0;i<r.FieldCount;i++)d[r.GetName(i)]=r.IsDBNull(i)?null:r.GetValue(i);return d;}
 public static async Task<List<Dictionary<string,object?>>> Many(NpgsqlConnection c,string sql,params (string,object?)[] args){await using var cmd=Cmd(c,sql,args);await using var r=await cmd.ExecuteReaderAsync();var result=new List<Dictionary<string,object?>>();while(await r.ReadAsync()){var d=new Dictionary<string,object?>();for(var i=0;i<r.FieldCount;i++)d[r.GetName(i)]=r.IsDBNull(i)?null:r.GetValue(i);result.Add(d);}return result;}
 public static async Task<int> Exec(NpgsqlConnection c,string sql,params (string,object?)[] args){await using var cmd=Cmd(c,sql,args);return await cmd.ExecuteNonQueryAsync();}
}
