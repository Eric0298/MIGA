using System.Text.RegularExpressions;

namespace Miga.Infrastructure.Materials;

/// <summary>
/// Parses ISO 8601 duration strings returned by the YouTube Data API v3
/// (e.g. "PT4H2M3S", "PT1H", "PT30M", "PT45S") into total seconds.
/// Returns 0 on malformed or unsupported input rather than throwing.
/// </summary>
public static class YouTubeDurationParser
{
    private static readonly Regex DurationRegex = new(
        "^PT(?:(\\d+)H)?(?:(\\d+)M)?(?:(\\d+)S)?$",
        RegexOptions.Compiled | RegexOptions.CultureInvariant);

    public static int ToSeconds(string? iso8601)
    {
        if (string.IsNullOrWhiteSpace(iso8601))
        {
            return 0;
        }

        var match = DurationRegex.Match(iso8601);
        if (!match.Success)
        {
            return 0;
        }

        var hours = match.Groups[1].Success ? int.Parse(match.Groups[1].Value) : 0;
        var minutes = match.Groups[2].Success ? int.Parse(match.Groups[2].Value) : 0;
        var seconds = match.Groups[3].Success ? int.Parse(match.Groups[3].Value) : 0;

        return checked(hours * 3600 + minutes * 60 + seconds);
    }
}
