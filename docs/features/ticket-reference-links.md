# Configurable external ticket links (Jira, etc.)

## Goal
Users configure one or more external ticketing systems. A ticket key written in a
comment (e.g. `ticketnumber-78305`, `ticketnumber-555`) becomes a clickable link; clicking opens
`baseUrl + key` in the browser. Implemented with parity in the VS Code extension (JS)
and the JetBrains plugin (Kotlin).

## Decisions (locked)
- **Detection:** bare keys — match any key that fits a configured `pattern` anywhere
   in a comment. `Tix: ticketnumber-78305` works because `ticketnumber-78305` is the matched key;
  `Tix:` is just optional prose. Keeps the existing `(?<!\w)…\b` guards so keys
  inside URLs / longer words are not matched.
- **`DOC-123`:** removed entirely (was a hardcoded fallback). Users configure any
  system they want; nothing is matched unless `ticketLinks` is set.
- **Setting shape:** per-system list `[{ baseUrl, pattern, label }]`. `baseUrl` +
  matched key = click URL; `pattern` = ticket-key regex; `label` = hover text.
  Multiple entries allowed (first match wins).

## Settings
```json
"commentDocLinks.ticketLinks": [
  { "baseUrl": "https://organization.atlassian.net/browse/",
    "pattern": "ticketnumber-\\d+",
    "label": "Jira" }
]
```
Default `[]` → no ticket links. Invalid `pattern` is skipped with a console warning
(guards against bad regex / ReDoS).

## VS Code (JS)
- `package.json` `contributes.configuration`: add `commentDocLinks.ticketLinks`
  (array of `{ baseUrl: string, pattern: string, label?: string }`).
- `src/config/configuration.js`: `getTicketLinks()` → validated
  `[{ baseUrl, regex: RegExp, label }]` (wrapped as `(?<!\w)(<pattern>)`).
- `src/references/referenceTypes.js`: add `TICKET = "ticket"` + label.
- `src/references/referenceParser.js`: delete `DOC-123` regex/anchored; thread
  `ticketLinks` through `detectReferenceSpans`/`parseComment`; matched keys become
  `TICKET` refs carrying `identifier` (key), `url`, `label`.
- `src/references/documentScanner.js`: read `getTicketLinks()` and pass to
  `parseComment` (single threading point; callers unchanged).
- `src/references/resolver.js`: `TICKET` → `EXTERNAL` with `url`/`label` attached.
- `src/commands/openReference.js`: when `user.url` set →
  `vscode.env.openExternal(vscode.Uri.parse(url))`.
- `src/references/hoverContent.js`: `TICKET` → `**<label> reference**` + markdown
  link `[key](url)`.
- Decoration: already treats `EXTERNAL` as link-colored — no change.

## JetBrains (Kotlin)
- `model/ReferenceType.kt`: add `TICKET("ticket")`.
- `model/ParsedReference.kt`: add `url: String?`, `label: String?`.
- `parser/ReferenceParser.kt`: delete `DOC-123`; add `data class TicketLink
  (baseUrl, pattern: Regex, label)`; thread `List<TicketLink>` through
  `detectReferenceSpans`/`parseComment`; matched keys → `TICKET` with `url`/`label`.
- `parser/DocumentScanner.kt`: read `CommentDocLinksConfig.ticketLinks` and pass to
  `parseComment`.
- `config/CommentDocLinksConfig.kt`: add `ticketLinks` (persisted as a delimited +
  URL-encoded string in `PropertiesComponent` — no new dependency); `getTicketLinks()`
  returns compiled `List<TicketLink>`.
- `resolver/ReferenceValidator.kt`: `TICKET` → `EXTERNAL` with `url`/`label`.
- `navigation/CommentDocReference.kt`: for `TICKET` with `url`, contribute a
  platform `WebReference` so Ctrl/Cmd+Click opens the browser.
- `decorations/CommentDocLinkAnnotator.kt`: tooltip `Open <label>: <url>` for
  URL-bearing externals.
- `config/CommentDocLinksConfigurable.kt` (new) + `plugin.xml` registration:
  table editor for `ticketLinks`.

## Tests (parity)
- Parser: configured keys detected; non-matching ignored; multiple systems; invalid
  pattern skipped; `DOC-123` no longer matched.
- Resolver: `url` built from `baseUrl + key`.
- Navigation: external open uses the URL.
- Hover: `TICKET` renders the link.
- `test/unit/*.test.js` (JS) and `jetbrains/src/test/kotlin/**` (Kotlin) mirror.
