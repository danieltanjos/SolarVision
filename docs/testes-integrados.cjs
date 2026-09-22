// Ambiente exclusivo: docker compose -f compose.qa.yml up -d --build
// Dependência: npm install --prefix .qa-tools playwright
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { chromium } = require('node:module').createRequire(path.resolve(__dirname, '../.qa-tools/package.json'))('playwright');
const root = path.resolve(__dirname, '..');
const base = 'http://localhost:8080';
const dir = path.join(__dirname, 'evidencias/integracao');
fs.mkdirSync(dir, {recursive:true});
const report = {inicio:new Date().toISOString(), ambiente:'Docker Compose solarvision-qa; PostgreSQL 17; backend Java 25; navegador Chrome headless', casos:[]};
const run = Date.now();
const email = `qa-${run}@example.test`;
const senha = 'Solar-QA-2026!';
let browser, context, page, token, group, panel;
function sql(query) {
  return execFileSync('docker', ['compose','-f','compose.qa.yml','exec','-T','postgres','psql','-U','solarvision_qa','-d','solarvision_qa','-v','ON_ERROR_STOP=1','-At','-c',query], {cwd:root,encoding:'utf8',windowsHide:true}).trim();
}
async function api(route, method='GET', data, expected=200, authenticated=true) {
  const response = await fetch(base+route, {method, headers:{'Content-Type':'application/json', ...(authenticated ? {Authorization:`Bearer ${token}`} : {})}, ...(data!==undefined ? {body:JSON.stringify(data)} : {}), signal:AbortSignal.timeout(20000)});
  const text = await response.text();
  assert.equal(response.status, expected, `${method} ${route}: ${response.status} ${text.slice(0,400)}`);
  return text ? JSON.parse(text) : null;
}
async function check(id, description, action) {
  const entry = {id, descricao:description, inicio:new Date().toISOString()};
  try {entry.obtido = await action(); entry.estado='aprovado';}
  catch(error) {entry.estado='falhou';entry.erro=error.message; process.exitCode=1;}
  entry.fim=new Date().toISOString(); report.casos.push(entry);
  fs.writeFileSync(path.join(dir,'resultado.json'),JSON.stringify(report,null,2));
  console.log(`${id}: ${entry.estado}${entry.erro ? ' - '+entry.erro : ''}`);
}
(async()=>{
  browser = await chromium.launch({channel:'chrome',headless:true});
  report.navegador=browser.version();
  context = await browser.newContext({viewport:{width:1440,height:1000},timezoneId:'America/Sao_Paulo'});
  page = await context.newPage(); page.setDefaultTimeout(20000);
  await check('FT-01','Registro, saída e login pelo navegador',async()=>{
    await page.goto(base+'/register');
    await page.getByPlaceholder('Nome',{exact:true}).fill('Pessoa QA');
    await page.getByPlaceholder('E-mail',{exact:true}).fill(email);
    await page.getByPlaceholder('Senha',{exact:true}).fill(senha);
    await page.getByPlaceholder('Confirmar senha',{exact:true}).fill(senha);
    await page.getByRole('button',{name:'Registrar-se',exact:true}).click();
    await page.waitForURL('**/app/home');
    await page.getByRole('button',{name:'Menu do usuário'}).click();
    await page.getByRole('button',{name:'Sair',exact:true}).click();
    await page.waitForURL('**/login');
    assert.equal(await page.evaluate(()=>localStorage.getItem('solarVisionToken')),null);
    await page.getByPlaceholder('E-mail',{exact:true}).fill(email);
    await page.getByPlaceholder('Senha',{exact:true}).fill(senha);
    await page.getByRole('button',{name:'Login',exact:true}).click();
    await page.waitForURL('**/app/home');
    token=await page.evaluate(()=>localStorage.getItem('solarVisionToken'));
    assert.ok(token);
    const user=await api('/api/users/me');assert.equal(user.email,email);
    await page.screenshot({path:path.join(dir,'FT-01-dashboard.png'),fullPage:true});
    return 'Conta persistida; logout removeu token; novo login abriu dashboard; GET /api/users/me confirmou a conta.';
  });
  await check('FT-02','API e rota privada sem autenticação',async()=>{
    const response=await fetch(base+'/api/cleanings');assert.ok([401,403].includes(response.status));
    const anonymous=await browser.newContext();const tab=await anonymous.newPage();
    try {await tab.goto(base+'/app/limpeza');await tab.waitForURL('**/login');await tab.getByRole('button',{name:'Login',exact:true}).waitFor();await tab.screenshot({path:path.join(dir,'FT-02-login.png'),fullPage:true});}
    finally {await anonymous.close();}
    return `API recusou com HTTP ${response.status}; rota privada redirecionou para login.`;
  });
  await check('FT-03','Cadastro e atualização de grupo e placa com persistência',async()=>{
    group=await api('/api/groups','POST',{nome:`Grupo QA ${run}`,status:'ATIVO'});
    panel=await api('/api/panels','POST',{grupoId:group.id,modelo:`Placa QA ${run}`,status:'ATIVA'});
    await api(`/api/groups/${group.id}`,'PUT',{nome:`Grupo atualizado ${run}`,status:'ATIVO'});
    await api(`/api/panels/${panel.id}`,'PUT',{grupoId:group.id,modelo:`Placa atualizada ${run}`,status:'ATIVA'});
    const g=await api(`/api/groups/${group.id}`);const p=await api(`/api/panels/${panel.id}`);
    assert.equal(g.nome,`Grupo atualizado ${run}`);assert.equal(p.modelo,`Placa atualizada ${run}`);assert.equal(p.grupoId,group.id);
    assert.equal(sql(`SELECT modelo FROM placas WHERE id=${Number(panel.id)}`),p.modelo);
    return `Grupo ${group.id} e placa ${panel.id} criados e atualizados; consulta HTTP e PostgreSQL confirmaram os dados.`;
  });
  await check('FT-04','Limpeza pela interface, recarga e exclusão pela API',async()=>{
    assert.ok(panel?.id);
    const observation=`Limpeza QA ${run}`;
    await page.goto(base+'/app/limpeza');
    await page.locator('select').selectOption(String(panel.id));
    await page.locator('input[type=datetime-local]').fill('2026-09-01T10:00');
    await page.locator('textarea').fill(observation);
    await page.getByRole('button',{name:'Salvar limpeza',exact:true}).click();
    await page.getByRole('cell',{name:observation,exact:true}).waitFor();
    await page.reload();await page.getByRole('cell',{name:observation,exact:true}).waitFor();
    await page.screenshot({path:path.join(dir,'FT-04-limpeza.png'),fullPage:true});
    const rows=await api('/api/cleanings');const row=rows.find(x=>x.observacao===observation);assert.ok(row);
    assert.equal(sql(`SELECT COUNT(*) FROM limpezas WHERE id=${Number(row.id)}`),'1');
    await api(`/api/cleanings/${row.id}`,'DELETE',undefined,204);
    await api(`/api/cleanings/${row.id}`,'GET',undefined,404);
    assert.equal(sql(`SELECT COUNT(*) FROM limpezas WHERE id=${Number(row.id)}`),'0');
    await page.reload();await page.getByText('Nenhuma limpeza registrada.',{exact:true}).waitFor();
    return 'Limpeza criada pela interface e mantida após recarga; registro confirmado no PostgreSQL; exclusão retornou 204, consulta posterior 404 e banco sem registro.';
  });
  await check('FT-05','Médias do dashboard por hora/dia com fixture PostgreSQL',async()=>{
    assert.ok(panel?.id);
    const date=new Date(Date.UTC(2040,0,1)+Math.floor(Math.random()*10000)*86400000).toISOString().slice(0,10);
    sql(`INSERT INTO leituras_energia(placa_id,data_hora,wats_gerados) VALUES (${Number(panel.id)},'${date}T10:00:00-03:00',100),(${Number(panel.id)},'${date}T10:30:00-03:00',300),(${Number(panel.id)},'${date}T11:00:00-03:00',500)`);
    const query=new URLSearchParams({dataInicio:date+'T00:00:00-03:00',dataFim:date+'T23:59:59-03:00',granularidade:'hora'});
    const hours=await api('/api/dashboard/metrics?'+query);assert.equal(hours.length,2);assert.equal(hours[0].y,200);assert.equal(hours[1].y,500);assert.equal(Date.parse(hours[0].x),Date.parse(date+'T10:00:00-03:00'));
    query.set('granularidade','dia');const days=await api('/api/dashboard/metrics?'+query);assert.equal(days.length,1);assert.equal(days[0].y,300);assert.equal(Date.parse(days[0].x),Date.parse(date+'T00:00:00-03:00'));
    return {fixture:[100,300,500],hora:hours,dia:days};
  });
  await check('FT-06','Ponte HTTP-gRPC e persistência da leitura/alerta',async()=>{
    assert.ok(panel?.id);
    const reading=await api(`/api/internal/grpc/panels/${panel.id}/check`,'POST');assert.equal(reading.success,true);assert.ok(reading.readingId>0);
    assert.equal(sql(`SELECT COUNT(*) FROM leituras_energia WHERE id=${Number(reading.readingId)} AND placa_id=${Number(panel.id)}`),'1');
    const alert=await api('/api/internal/grpc/alerts','POST',{panelId:panel.id,type:'QA',severity:'ALTA'});assert.equal(alert.success,true);assert.ok(alert.alertId>0);
    assert.equal(sql(`SELECT COUNT(*) FROM alertas WHERE id=${Number(alert.alertId)} AND placa_id=${Number(panel.id)}`),'1');
    return {readingId:reading.readingId,alertId:alert.alertId,persistencia:'Confirmada em PostgreSQL',email:'Fora do escopo: envio real não implementado'};
  });
})().catch(error=>{report.erro=error.message;process.exitCode=1;console.error(error.message);}).finally(async()=>{
  if(browser)await browser.close();report.fim=new Date().toISOString();report.aprovados=report.casos.filter(x=>x.estado==='aprovado').length;report.falhas=report.casos.filter(x=>x.estado==='falhou').length;
  fs.writeFileSync(path.join(dir,'resultado.json'),JSON.stringify(report,null,2));
});
