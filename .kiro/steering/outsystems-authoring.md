# OutSystems authoring conventions

Conventions for how I hand OutSystems artifacts to the user to enter in ODC
Studio. These apply whenever a build step is done manually in Studio (e.g. the
mobile-library build sheet), since the connected OutSystems MCP cannot create
or load MobileLibrary / Mobile app assets.

The ODC platform rules (assets, Blocks, Public actions, JavaScript nodes) are in
`odc-mobile-rules.md`. Follow its pre-flight checklist before writing any step.

## Structures: always provide paste-ready sample JSON

Whenever I ask the user to create an OutSystems **Structure**, I MUST provide a
**sample JSON object** the user can paste straight into Studio's
**"Add Structure from JSON"** (right-click Structures → Add Structure from
JSON). ODC infers each attribute and its data type from the JSON, so the object
must use representative *values*, not type names.

Rules:

- Provide a JSON **object** (one representative record), not a schema, not an
  array, not a map of attribute-name → type-name.
- Attribute names in the JSON become the structure attribute names exactly, so
  use the exact OutSystems attribute names (e.g. `VoiceIndex`, not `voice_index`).
- Choose each value so ODC infers the intended type. ODC's inference:

  | Intended ODC type | Use a JSON value like        |
  |-------------------|------------------------------|
  | Text              | `"sample"` (any string)      |
  | Integer           | `0`                          |
  | Long Integer      | `0` (large integers)         |
  | Decimal           | `0.0` (must have a decimal)  |
  | Boolean           | `true`                       |
  | Date              | `"2026-01-01"`               |
  | Date Time         | `"2026-01-01T00:00:00Z"`     |

  Note: a whole number like `0` infers as an integer type; to force **Decimal**
  the value must be written with a decimal point (`1.0`, `0.0`). This matters
  for fields like rate/pitch/volume that are Decimal in the spec.

- After the JSON, add a short table listing each attribute and its intended ODC
  type, and call out any attribute whose inferred type the user must adjust by
  hand (e.g. ODC inferring Long Integer where the spec wants Integer). JSON
  type inference is a starting point; the explicit type table is the source of
  truth if they disagree.
- Keep the paste JSON and the design/spec in sync: the attribute set and names
  must match the structure as defined in the design doc.

### Example

For a `TTSVoice` structure (`VoiceIndex` Integer, `Name` Text, `Lang` Text,
`IsDefault` Boolean, `IsLocalService` Boolean, `VoiceURI` Text), provide:

```json
{
  "VoiceIndex": 0,
  "Name": "Samantha",
  "Lang": "en-US",
  "IsDefault": true,
  "IsLocalService": true,
  "VoiceURI": "com.apple.voice.compact.en-US.Samantha"
}
```

Then note: `VoiceIndex` should be **Integer** (adjust if ODC infers Long
Integer); the rest infer correctly (`Name`/`Lang`/`VoiceURI` → Text,
`IsDefault`/`IsLocalService` → Boolean).
