# KeePassXC Vault Initialization

XAICore provides a local KeePassXC initialization utility for creating an importable
empty vault structure. The utility does not generate passwords, store secrets, create
MFA seeds, or write a `.kdbx` database. It creates only a KeePass XML import file with
approved groups and blank entry fields.

## Command

```powershell
npm run keepassxc:init -- --output '.xaicore-private\keepassxc\xaicore-empty-vault.xml'
```

The command refuses to overwrite an existing file. Import the generated XML into a new
empty KeePassXC database, then fill the entries manually inside KeePassXC.

## Boundary

- Do not paste vault passwords, MFA seeds, recovery codes, or API keys into chat.
- Do not commit `.kdbx` files or generated private XML imports.
- Store the KeePassXC database and recovery material outside the repository backup.
- Keep Owner MFA and recovery material under Owner control.
true