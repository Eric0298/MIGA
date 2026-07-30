using System.Text.Json;
using Miga.Contracts.Data;
using Shouldly;

namespace Miga.UnitTests.Data;

public sealed class DataSnapshotContractsTests
{
    [Fact]
    public void PutRequest_ShouldUseExactWireNames()
    {
        var data = JsonSerializer.SerializeToElement(ValidDataSnapshot.Create());
        var json = JsonSerializer.Serialize(
            new PutDataSnapshotRequest(Guid.CreateVersion7(), 4, data));

        using var document = JsonDocument.Parse(json);
        document.RootElement.EnumerateObject().Select(property => property.Name)
            .ShouldBe(["workspaceId", "revision", "data"]);
    }

    [Fact]
    public void Response_ShouldUseExactWireNames()
    {
        var data = JsonSerializer.SerializeToElement(ValidDataSnapshot.Create());
        var response = new DataSnapshotResponse(
            5,
            new DateTimeOffset(2026, 7, 23, 10, 0, 0, TimeSpan.Zero),
            data
        );
        var json = JsonSerializer.Serialize(response);

        using var document = JsonDocument.Parse(json);
        document.RootElement.EnumerateObject().Select(property => property.Name)
            .ShouldBe(["revision", "updatedAtUtc", "data"]);
    }

    [Fact]
    public void PutRequest_ShouldRejectUnknownEnvelopeProperties()
    {
        var json =
            $$"""
            {
              "workspaceId": "{{Guid.NewGuid()}}",
              "revision": 0,
              "data": {{ValidDataSnapshot.Create().ToJsonString()}},
              "ownerId": "{{Guid.NewGuid()}}"
            }
            """;

        Should.Throw<JsonException>(() => JsonSerializer.Deserialize<PutDataSnapshotRequest>(json));
    }

    [Theory]
    [InlineData("""{"workspaceId":"01983d12-a3e7-7000-8000-000000000001","revision":0}""")]
    [InlineData("""{"workspaceId":"01983d12-a3e7-7000-8000-000000000001","data":{}}""")]
    [InlineData("""{"revision":0,"data":{}}""")]
    public void PutRequest_ShouldRequireAllProperties(string json)
    {
        Should.Throw<JsonException>(() => JsonSerializer.Deserialize<PutDataSnapshotRequest>(json));
    }
}
