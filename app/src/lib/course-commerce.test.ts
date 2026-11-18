import {beforeEach,expect,it} from 'vitest';
import {useCourseCommerce} from './course-commerce';
beforeEach(()=>useCourseCommerce.setState({memberships:[],invoices:[]}));
it('requires membership and separates observation, fulfillment and licensing',async()=>{
 const s=useCourseCommerce.getState();
 await expect(s.checkout('dotnet')).rejects.toThrow();
 await s.enroll('dotnet');await s.enroll('dotnet');await s.checkout('dotnet');await s.checkout('dotnet');
 expect(useCourseCommerce.getState().memberships).toHaveLength(1);
 expect(useCourseCommerce.getState().invoices).toHaveLength(1);
 await s.observePayment('dotnet');expect(useCourseCommerce.getState().memberships[0].paidAccess).toBe(false);
 await s.processPayment('dotnet');expect(useCourseCommerce.getState().memberships[0].licenseStatus).toBe('pending');
 await s.finishLicense('dotnet',true);expect(useCourseCommerce.getState().memberships[0].licenseStatus).toBe('needsReconciliation');
});
it('manual activation enrolls and preserves an existing license',async()=>{
 const s=useCourseCommerce.getState();await expect(s.activate('dotnet','manual','')).rejects.toThrow();
 await s.activate('dotnet','manual','manual-key');await s.activate('dotnet','api');
 expect(useCourseCommerce.getState().memberships[0]).toMatchObject({paidAccess:true,licenseStatus:'ready',licenseSource:'manual',licenseKey:'manual-key'});
});
