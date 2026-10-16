using System.Text.Json;
using FixPortal.FixAtdl.Contracts;
using FixPortal.FixAtdl.Xml;

if (args.Length != 3)
{
    throw new ArgumentException("Expected producer root, authored XML, and output path.");
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
