import {technicalError,emit,safeSqlErrors} from './observability.js';
import {listPolicies,policyImpact,createPolicy,consultAvailability,informAvailability,operationalState,consolidatedDetail} from './b3-operations.js';
import {planningCatalog,listActivities,activityDetail,createActivity,addParticipant,evaluateParticipant,PlanningError} from './b3.js';
import {confirmParticipation,requestException,decideException,listExceptions,sqlContractError} from './b3-contracts.js';
export function mountPlanning(app, cfg, {session,sameOrigin}) {
  const route = fn => async (req,res) => {
    try { res.json(await fn(req)); } catch (e) {
      e=sqlContractError(e);
      if(cfg.b34&&!(e instanceof PlanningError)){
        if(e.message==='Identificador invalido')e=new PlanningError('CAMPOS_INVALIDOS');
        else{emit(cfg,'operation.failure',{errors:safeSqlErrors(e)});return res.status(technicalError(e)?503:500).json({erro:'ERRO_TECNICO',referencia:res.getHeader('X-Jetta-Correlation')});}
      }
      const code = e instanceof PlanningError ? e.code : 'OPERACAO_RECUSADA';
      res.status(e instanceof PlanningError ? e.status : 400).json({erro: code});
    }
  };
  app.get('/api/b3/catalogo',session,route(r => planningCatalog(cfg,r.user.id)));
  app.get('/api/b3/atividades',session,route(async r => ({atividades:await listActivities(cfg,r.user.id)})));
  app.get('/api/b3/atividades/:id',session,route(r => cfg.b34?consolidatedDetail(cfg,r.user.id,r.params.id):activityDetail(cfg,r.user.id,r.params.id)));
  app.post('/api/b3/atividades',sameOrigin,session,route(r => createActivity(cfg,r.user.id,r.body)));
  app.post('/api/b3/atividades/:id/participantes',sameOrigin,session,route(r => addParticipant(cfg,r.user.id,r.params.id,r.body)));
  app.get('/api/b3/participacoes/:id/limite',session,route(r => evaluateParticipant(cfg,r.user.id,r.params.id)));
  if(cfg.b33===true){
    app.get('/api/b3/politicas',session,route(r=>listPolicies(cfg,r.user.id)));
    app.post('/api/b3/politicas/impacto',sameOrigin,session,route(r=>policyImpact(cfg,r.user.id,r.body)));
    app.post('/api/b3/politicas',sameOrigin,session,route(r=>createPolicy(cfg,r.user.id,r.rawSession,r.body)));
    app.post('/api/b3/disponibilidade/consulta',sameOrigin,session,route(r=>consultAvailability(cfg,r.user.id,r.body)));
    app.post('/api/b3/disponibilidade',sameOrigin,session,route(r=>informAvailability(cfg,r.user.id,r.body)));
    app.get('/api/b3/participacoes/:id/operacional',session,route(r=>operationalState(cfg,r.user.id,r.params.id)));
  }
  if(cfg.b32===true){
    app.post('/api/b3/participacoes/:id/confirmar',sameOrigin,session,route(r=>confirmParticipation(cfg,r.user.id,r.rawSession,r.params.id,r.body)));
    app.post('/api/b3/participacoes/:id/excecoes',sameOrigin,session,route(r=>requestException(cfg,r.user.id,r.params.id,r.body)));
    app.get('/api/b3/excecoes',session,route(async r=>({excecoes:await listExceptions(cfg,r.user.id)})));
    app.post('/api/b3/excecoes/:id/decidir',sameOrigin,session,route(r=>decideException(cfg,r.user.id,r.rawSession,r.params.id,r.body)));
  }
}
