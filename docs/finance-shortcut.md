# Logging spending from an iPhone Shortcut

`POST /api/finance/entries` logs one entry into the caller's finance space
(the household, when they're in one) and shows it as theirs. It exists so
logging a purchase takes a few seconds from the Action button, Lock Screen
or Siri, without opening the app.

## Keys

Each person makes their own key on **Finance → Spending → Log from your
iPhone**. A key is `<base64url user id>.<HMAC>`, signed with `AUTH_SECRET`
and versioned by the id of that person's latest
`finance.shortcut_key_created` event. Making a new key turns the old one
off. Nothing secret is stored. Rotating `AUTH_SECRET` turns every key off.
Hidden in demo mode (a key always writes real data).

## Request

```
POST /api/finance/entries
Authorization: Bearer <personal key>
Content-Type: application/json

{ "amount": "12.50", "description": "Trader Joe's",
  "category": "Groceries", "account": "Sapphire", "date": "2026-11-02",
  "direction": "out" }
```

Only `amount` is required. `category` must be one of the finance
categories (case-insensitive) or it is left for sorting. `account` matches
an account name exactly, then by substring. `date` defaults to today.

Responses always carry a `message` meant to be shown in a notification:
`201 { ok: true, id, message: "Logged $12.50 at Trader Joe's" }`,
`400` bad body, `401` wrong or replaced key.

## Building the Shortcut

1. Ask for Input (Number) "How much?"
2. Ask for Input (Text) "Where?"
3. Get Contents of URL: the address above, Method POST, header
   `Authorization: Bearer <key>`, JSON body `amount` and `description`.
4. Get Dictionary Value `message` → Show Notification.
5. Assign it to the Action button, Lock Screen, or Control Center.
