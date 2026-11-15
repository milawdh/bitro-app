using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Diagnostics.HealthChecks;

namespace BitroLearn.Api.Controllers.Public;

[Route("public/health")]
public sealed class HealthController(HealthCheckService health) : PublicAreaController
{
    #region Public Health Endpoints
    [HttpGet("live")]
    [AllowAnonymous]
    public IActionResult Live() => Ok(new { status = "Healthy" });

    [HttpGet("ready")]
    [AllowAnonymous]
    public async Task<IActionResult> Ready(CancellationToken cancellationToken)
    {
        var report = await health.CheckHealthAsync(cancellationToken);
        return StatusCode(report.Status == HealthStatus.Unhealthy ? 503 : 200,
            new { status = report.Status.ToString(), checks = report.Entries.ToDictionary(entry => entry.Key, entry => entry.Value.Status.ToString()) });
    }
    #endregion
}
