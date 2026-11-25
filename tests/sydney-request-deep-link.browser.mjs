import assert from 'node:assert/strict';
import {chromium} from 'playwright';
// Run against a local staging-mode Vite server with VITE_SUPABASE_URL=https://procureflow-test.invalid and a synthetic, non-secret key.
const rootUrl = new URL(process.env.PF_TEST_URL || 'https://127.0.0.1:3107');
assert.ok(['127.0.0.1','localhost'].includes(rootUrl.hostname), 'Use only a local synthetic test app');
const root = rootUrl.origin;
const path='/requests/00000000-0000-4000-8000-000000000042';
const sydney='77777777-7777-4777-8777-777777777777';
const classic='88888888-8888-4888-8888-888888888888';
const requestId=path.split('/').at(-1);
const b=await chromium.launch({executablePath:process.env.PF_CHROMIUM_PATH,args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu']});
try {
 const c=await b.newContext({ignoreHTTPSErrors:true, serviceWorkers:'block'});
 await c.addInitScript(({sydney,classic}) => {
   if (new URL(location.href).searchParams.get('synthetic-auth') === '1') {
     localStorage.setItem('activeSiteIds', JSON.stringify([classic]));
     localStorage.setItem('pf_test_user',JSON.stringify({id:'d593571a-c4bd-4627-8b03-33704226e826', name:'Synthetic Pilot Approver', email:'david.you@splservices.com.au', role:'SITE_MANAGER', avatar:'PA', permissions:['approve_requests'], siteIds:[classic,sydney]}));
   }
 }, { sydney, classic });
 let capturedCallback=false;
 let exactReads=0;
 let writes=0;
 await c.route('**/*', async route=>{
   const u = new URL(route.request().url());
   if(u.origin===root) return route.continue();
   if(u.origin!=='https://procureflow-test.invalid') return route.abort();
   if(u.pathname==='/auth/v1/authorize') {
     assert.equal(u.searchParams.get('redirect_to'),root);
     capturedCallback=true;
     return route.fulfill({status:302,headers:{location:root+'/?synthetic-auth=1'}});
   }
   if (route.request().method() !== 'GET' && ['/rest/v1/po_requests','/rest/v1/po_approvals'].includes(u.pathname)) writes++;
   if (u.pathname==='/rest/v1/po_requests' && u.searchParams.has('id')) {
     assert.equal(u.searchParams.get('id'),'eq.'+requestId);
     assert.equal(u.searchParams.get('site_id'),'in.('+sydney+')');
     assert.equal(u.searchParams.get('limit'),'1');
     exactReads++;
     return route.fulfill({status:200,json:[{id:requestId,site_id:sydney,display_id:'SYNTHETIC-SYD-42',request_date:'2026-11-25',requester_id:'different-user',requester:{name:'Synthetic Requester'},site:{name:'SPL Sydney'},supplier:{name:'Synthetic Supplier'},status:'PENDING_APPROVAL',total_amount:100,lines:[],approvals:[],deliveries:[]}]});
   }
   return route.fulfill({status:200,contentType:'application/json',body:'[]'});
 });
 const page=await c.newPage();
 await page.goto(root+path);
 await page.waitForURL(root+'/login');
 assert.equal(await page.evaluate(()=>history.state.usr.requestPath),path);
 await page.getByRole('button',{name:'Sign in with Microsoft'}).click();
 await page.waitForURL(root+path);
 assert.equal(capturedCallback,true);
 await page.getByText('SYNTHETIC-SYD-42',{exact:true}).first().waitFor();
 await page.getByRole('button',{name:'Approve',exact:true}).waitFor();
 assert.ok(exactReads > 0);
 assert.equal(await page.evaluate(()=>localStorage.getItem('activeSiteIds')),JSON.stringify([classic]));
 assert.equal(writes,0);
 assert.equal(await page.evaluate(()=>sessionStorage.getItem('pf_request_after_sign_in')),null);
 // Root navigation after later sign-in/reload must not reuse the earlier path.
 await page.goto(root);
 await page.waitForTimeout(500);
 assert.equal(new URL(page.url()).pathname,'/');
 console.log('Browser: logged-out card route → Microsoft mock → exact Sydney request and authorized Approve control, with Classic Linen preference unchanged and no requisition writes.');

 const before=exactReads;
 await page.evaluate((classic) => {
     localStorage.setItem('activeSiteIds', JSON.stringify([classic]));
     localStorage.setItem('pf_test_user',JSON.stringify({id:'not-eligible-for-sydney',name:'Synthetic Other Site Manager',email:'other@example.invalid',role:'SITE_MANAGER',permissions:['approve_requests'],siteIds:[classic]}));
 },classic);
 await page.goto(root+path);
 await page.getByText('PO Not Found',{exact:true}).waitFor();
 await page.waitForTimeout(700);
 assert.equal(exactReads,before);
 assert.equal(await page.getByText('SYNTHETIC-SYD-42',{exact:true}).count(),0);
 assert.equal(await page.getByRole('button',{name:'Approve',exact:true}).count(),0);
 assert.equal(writes,0);
 console.log('Browser: manager without Sydney access sees no request and no approve button; browser did not attempt the exact query.');
} finally {await b.close();}
