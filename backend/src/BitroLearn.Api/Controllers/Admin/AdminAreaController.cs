using BitroLearn.Api.Infrastructure.Authentication;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace BitroLearn.Api.Controllers.Admin;

#region Area Definition
[ApiController]
[Area("Admin")]
[Tags("Admin")]
[Authorize(Policy = AuthPolicies.AdminArea)]
public abstract class AdminAreaController : ControllerBase { }
#endregion
