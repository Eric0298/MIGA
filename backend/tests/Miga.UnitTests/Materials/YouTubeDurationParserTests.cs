using Miga.Infrastructure.Materials;
using Shouldly;

namespace Miga.UnitTests.Materials;

public sealed class YouTubeDurationParserTests
{
    [Theory]
    [InlineData("PT0S", 0)]
    [InlineData("PT45S", 45)]
    [InlineData("PT30M", 30 * 60)]
    [InlineData("PT1H", 3600)]
    [InlineData("PT1H30M", 3600 + 30 * 60)]
    [InlineData("PT4H2M3S", 4 * 3600 + 2 * 60 + 3)]
    [InlineData("PT23H59M59S", 23 * 3600 + 59 * 60 + 59)]
    public void ToSeconds_ShouldParse_ValidIso8601(string iso, int expected)
    {
        YouTubeDurationParser.ToSeconds(iso).ShouldBe(expected);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    [InlineData("nonsense")]
    [InlineData("P1D")]
    [InlineData("P1DT1H")]
    public void ToSeconds_ShouldReturn0_ForInvalidInput(string? iso)
    {
        YouTubeDurationParser.ToSeconds(iso).ShouldBe(0);
    }
}
