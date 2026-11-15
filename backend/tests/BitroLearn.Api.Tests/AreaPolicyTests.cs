using System.Reflection;
using BitroLearn.Api.Controllers.Admin;
using BitroLearn.Api.Controllers.App;
using BitroLearn.Api.Controllers.Public;
using BitroLearn.Api.Infrastructure.Authentication;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace BitroLearn.Api.Tests;

public sealed class AreaPolicyTests
{
    #region Route and authorization boundaries

    [Fact]
    public void Every_concrete_controller_has_an_area_and_matching_direct_prefix()
    {
        var controllers = typeof(PublicAreaController).Assembly.GetTypes()
            .Where(type => !type.IsAbstract && typeof(ControllerBase).IsAssignableFrom(type)).ToArray();
        Assert.NotEmpty(controllers);
        foreach (var controller in controllers)
        {
            var area = controller.GetCustomAttribute<AreaAttribute>(inherit: true)?.RouteValue;
            Assert.Contains(area, new[] { "Public", "Admin", "App" });
            var routes = controller.GetCustomAttributes<RouteAttribute>(inherit: true).ToArray();
            Assert.NotEmpty(routes);
            foreach (var route in routes)
                Assert.StartsWith(area!.ToLowerInvariant() + "/", route.Template);
        }
    }

    [Fact]
    public void Protected_areas_cannot_inherit_anonymous_access()
    {
        Assert.Null(typeof(PublicAreaController).GetCustomAttribute<AllowAnonymousAttribute>(true));
        Assert.Null(typeof(AdminAreaController).GetCustomAttribute<AllowAnonymousAttribute>(true));
        Assert.Null(typeof(AppAreaController).GetCustomAttribute<AllowAnonymousAttribute>(true));
        Assert.Equal(AuthPolicies.AdminArea, typeof(AdminAreaController).GetCustomAttribute<AuthorizeAttribute>(true)?.Policy);
        Assert.Equal(AuthPolicies.AppArea, typeof(AppAreaController).GetCustomAttribute<AuthorizeAttribute>(true)?.Policy);
    }

    #endregion
}
