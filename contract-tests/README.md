# Fresh C# producer contract test

This lane builds the real `FixPortal.FixAtdl.Contracts` producer and feeds its freshly serialized bytes into this React consumer. It never regenerates the committed POV fixture or the producer's immutable goldens.

CI checks out the public producer at `5411d52998b5b05621f2edb72fd0050c9729a91e` beside the React checkout. Update that explicit pin when qualifying a newer producer contract. The console project references its actual source; it does not reproduce DTOs or serializer options.

With Node 24 and .NET 10 installed:

```sh
npm ci
npm run build
FIXATDL_SOURCE_ROOT=/absolute/path/to/fixportal-fixatdl npm run test:producer-contract
```

The producer reads the authored `all-controls.xml` plus the pinned producer's real `tz-clock.xml` and `regions-enums.xml`, maps each document through `AtdlDtoMapper`, and serializes the wrapper with `AtdlContractJson.Options`. The same fresh JSON is assigned, without casts, to the built package's exported declarations under NodeNext and bundler resolution, then consumed by the real React renderer and form state.

The assertions cover all fifteen control types, exact panel/control discriminators, accessible controls and labels, spinner increments, enum wire values, hidden constants, and Clock market-local display and UTC instant. The multi-strategy documents are unwrapped before checking specific nested forms and strategy edits. This is a separate required CI job, so the ordinary Node-only test command keeps its existing prerequisites.

Generated JSON and temporary consumers live only in a unique current-run directory under `node_modules/.cache`. The script removes that owned directory in `finally`; it never deletes a shared stale output directory. Producer `bin` and `obj` outputs are ignored.

The same required producer command also runs eight literal wire-input emission cases through
.NET's real parameter setters and `StrategyParametersGrpEmitter`, then compares its fresh ordered
957-960 tuples to the public React emitter after the real `parameterFromWire` decoder. Inputs live
in `emission-cases.json`; expected tuple arrays are never authored or checked in. This bounds parity
to the canonical String/Int/Float/Boolean/enum values in the pinned expressions fixture, including
empty output and declaration order. It does not assert all type/invalid-input policies are identical.
