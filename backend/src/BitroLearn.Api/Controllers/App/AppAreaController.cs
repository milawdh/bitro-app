using BitroLearn.Api.Infrastructure.Authentication;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace BitroLearn.Api.Controllers.App;

#region Area Definition
[ApiController]
[Area("App")]
[Tags("App")]
[Authorize(Policy = AuthPolicies.AppArea)]
public abstract class AppAreaController : ControllerBase { }
#endregion
