function Get-RuntimeIdentityProof([string]$Token,[string]$Challenge) {
 if ($Token -notmatch '^[a-f0-9]{64}$' -or $Challenge -notmatch '^[a-f0-9]{64}$') {throw 'Desafio de identidade inválido.'}
 # Node crypto.createHmac receives the UTF-8 token string, not decoded hex bytes.
 $hmac=[Security.Cryptography.HMACSHA256]::new([Text.Encoding]::UTF8.GetBytes($Token))
 try {return ([BitConverter]::ToString($hmac.ComputeHash([Text.Encoding]::UTF8.GetBytes($Challenge)))).Replace('-','').ToLowerInvariant()} finally {$hmac.Dispose()}
}
