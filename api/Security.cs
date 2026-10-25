using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.WebUtilities;

namespace Vizora;
public static class Security
{
 public static string HashPassword(string password){var salt=RandomNumberGenerator.GetBytes(16); var hash=Rfc2898DeriveBytes.Pbkdf2(password,salt,210000,HashAlgorithmName.SHA256,32);return $"pbkdf2$210000${Convert.ToBase64String(salt)}${Convert.ToBase64String(hash)}";}
 public static bool VerifyPassword(string password,string encoded){try{var a=encoded.Split('$'); if(a.Length!=4||a[0]!="pbkdf2"||!int.TryParse(a[1],out var iter)||iter<100000)return false;return CryptographicOperations.FixedTimeEquals(Rfc2898DeriveBytes.Pbkdf2(password,Convert.FromBase64String(a[2]),iter,HashAlgorithmName.SHA256,32),Convert.FromBase64String(a[3]));}catch{return false;}}
 public static string SignToken(object payload,string secret){var header=Base64UrlEncode(Encoding.UTF8.GetBytes("{\"alg\":\"HS256\",\"typ\":\"JWT\"}"));var data=header+"."+Base64UrlEncode(JsonSerializer.SerializeToUtf8Bytes(payload));var sig=HMACSHA256.HashData(Encoding.UTF8.GetBytes(secret),Encoding.UTF8.GetBytes(data));return data+"."+Base64UrlEncode(sig);}
 public static JsonDocument? VerifyToken(string token,string secret){try{var a=token.Split('.');if(a.Length!=3)return null;using var header=JsonDocument.Parse(Base64UrlDecode(a[0]));if(header.RootElement.GetProperty("alg").GetString()!="HS256")return null;var data=a[0]+"."+a[1];var sig=HMACSHA256.HashData(Encoding.UTF8.GetBytes(secret),Encoding.UTF8.GetBytes(data));if(!CryptographicOperations.FixedTimeEquals(sig,Base64UrlDecode(a[2])))return null;var doc=JsonDocument.Parse(Base64UrlDecode(a[1]));if(!doc.RootElement.TryGetProperty("exp",out var exp)||!exp.TryGetInt64(out var expires)||expires<=DateTimeOffset.UtcNow.ToUnixTimeSeconds()){doc.Dispose();return null;}return doc;}catch{return null;}}
 public static string Base64UrlEncode(byte[] b)=>WebEncoders.Base64UrlEncode(b);
 public static byte[] Base64UrlDecode(string s)=>WebEncoders.Base64UrlDecode(s);
 public static string RsaSign(string msg,string pem){using var rsa=RSA.Create();rsa.ImportFromPem(pem);return Convert.ToBase64String(rsa.SignData(Encoding.UTF8.GetBytes(msg),HashAlgorithmName.SHA256,RSASignaturePadding.Pkcs1));}
 public static bool RsaVerify(string msg,string signature,string pem){try{using var rsa=RSA.Create();rsa.ImportFromPem(pem);return rsa.VerifyData(Encoding.UTF8.GetBytes(msg),Convert.FromBase64String(signature),HashAlgorithmName.SHA256,RSASignaturePadding.Pkcs1);}catch{return false;}}
 public static string GetRequired(IConfiguration c,string path){var v=c[path];if(string.IsNullOrWhiteSpace(v))throw new InvalidOperationException($"Missing secure setting: {path}");return v.Replace("\\n","\n");}
}
