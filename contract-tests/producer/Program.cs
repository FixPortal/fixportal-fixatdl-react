using System.Text.Json;
using FixPortal.FixAtdl.Contracts;
using FixPortal.FixAtdl.Fix;
using FixPortal.FixAtdl.Xml;

if (args.Length != 5)
{
    throw new ArgumentException("Expected producer root, authored XML, DTO output, emission inputs, and emission output.");
}
var inputs = new[]
{
    args[1],
    Path.Combine(args[0], "tests/FixPortal.FixAtdl.Tests/Fixtures/RealWorld/tz-clock.xml"),
    Path.Combine(args[0], "tests/FixPortal.FixAtdl.Tests/Fixtures/RealWorld/regions-enums.xml"),
};
var cases = inputs.Select(path =>
{
    using var stream = File.OpenRead(path);
    var strategies = new StrategiesReader().Load(stream);
    // Serialize the actual wrapper: polymorphic panel children retain their declared base type.
    return new { source = Path.GetFileName(path), contract = new AtdlDtoMapper().Map(strategies) };
}).ToArray();
File.WriteAllText(args[2], JsonSerializer.Serialize(cases, AtdlContractJson.Options));

// Inputs are literal wire values, never expected tags. Reload each real model so no case inherits state.
using var emissionInputs = JsonDocument.Parse(File.ReadAllText(args[3]));
var emissions = emissionInputs.RootElement.EnumerateArray().Select(input =>
{
    using var stream = File.OpenRead(Path.Combine(
        args[0], "tests/FixPortal.FixAtdl.Tests/Fixtures/Conformance/expressions.xml"));
    var strategies = new StrategiesReader().Load(stream);
    var strategy = strategies.Strategies[0];
    var wireValues = input.GetProperty("wireValues").Deserialize<Dictionary<string, string>>()!;
    foreach (var (name, wire) in wireValues)
    {
        strategy.Parameters[name].WireValue = wire;
    }
    return new
    {
        id = input.GetProperty("id").GetString(),
        wireValues,
        contract = new AtdlDtoMapper().Map(strategies),
        // Preserve the production emitter's order and values. Only tuple field names are adapted.
        tags = StrategyParametersGrpEmitter.Emit(strategy).Select(tag => new { tag = tag.Tag, value = tag.Value }).ToArray(),
    };
}).ToArray();
File.WriteAllText(args[4], JsonSerializer.Serialize(emissions, AtdlContractJson.Options));
