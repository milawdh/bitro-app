using Microsoft.AspNetCore.Mvc;

namespace BitroLearn.Api.Controllers.Public;

#region Area Definition
[ApiController]
[Area("Public")]
[Tags("Public")]
public abstract class PublicAreaController : ControllerBase { }
#endregion
