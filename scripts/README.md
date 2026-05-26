# Scripts

## GramJS string session (`TG_STRING_SESSION`)

Para **`credentials.kind: "mtproto"`** el SDK necesita una **string session** de GramJS (connection string). Eso es distinto del **bot token** de [@BotFather](https://t.me/BotFather), que solo aplica a `kind: "botApi"`.

| Credencial | Origen | Uso en el SDK |
| ---------- | ------ | --------------- |
| `botToken` | BotFather | `credentials.kind: "botApi"` |
| `apiId` + `apiHash` | [my.telegram.org/apps](https://my.telegram.org/apps) | MTProto |
| `stringSession` | Login interactivo con GramJS (este script) | MTProto |

### Pasos

1. Copia `scripts/.env.example` → `scripts/.env` (solo `TG_API_ID` + `TG_API_HASH`).
2. Desde la raíz del repo:

```bash
set -a && source scripts/.env && set +a
npm run script:gramjs-session
```

3. Introduce teléfono, código de Telegram y contraseña 2FA si la tienes.
4. Copia **`TG_STRING_SESSION`** del output a tu `.env` (no commitear).

Ejemplo de bloque MTProto en `.env`:

```env
TG_API_ID=123456
TG_API_HASH=abcdef0123456789abcdef0123456789
TG_STRING_SESSION=1AgA...   # connection string de GramJS
```

En código:

```ts
credentials: {
  kind: "mtproto",
  apiId: Number(process.env.TG_API_ID),
  apiHash: process.env.TG_API_HASH!,
  stringSession: process.env.TG_STRING_SESSION!,
}
```

Si ya tienes una sesión válida en `TG_STRING_SESSION`, el script puede reutilizarla; si expiró, volverá a pedir login.

Ejemplo live: [`examples/mtproto-runtime/`](../examples/mtproto-runtime/) (`npm run example:mtproto`).

Plantilla: [`.env.example`](./.env.example) · Implementación: [`generate-mtproto-session.ts`](./generate-mtproto-session.ts)
