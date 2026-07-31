(() => {
  class ProjectRepositoryService {
    constructor(){ this.client = null; }
    initialize(client){
      if(!client) throw new Error('Supabase client is required.');
      this.client = client;
      return this;
    }
    requireClient(){
      if(!this.client) throw new Error('Supabase is not connected.');
      return this.client;
    }
    async testConnection(){
      const db=this.requireClient();
      const {error}=await db.from('projects').select('id').limit(1);
      if(error) throw error;
      return true;
    }
    async getPortfolio(){
      const db=this.requireClient();
      const [projectResult, resourceResult, salesResult] = await Promise.all([
        db.from('project_portfolio_view').select('*'),
        db.from('resources').select('*').order('name'),
        db.from('project_sales_marketing').select('*')
      ]);
      if(projectResult.error) throw projectResult.error;
      if(resourceResult.error) throw resourceResult.error;
      // Older databases may not yet have the sales table. Core projects still load.
      const salesRows = salesResult.error ? [] : (salesResult.data || []);
      const salesByProject = new Map(salesRows.map(row => [row.project_id, row]));
      const projects=(projectResult.data||[]).map(row => {
        const sales=salesByProject.get(row.id)||{};
        return {
          id:row.id,
          name:row.name,
          description:row.description||'',
          division:row.division||'',
          category:row.category||'',
          status:row.status||'Proposed',
          champion:row.champion||'Unassigned',
          sponsor:row.executive_sponsor||'',
          startDate:row.start_month ? String(row.start_month).slice(0,7) : '',
          input:{
            hours:Number(row.hours)||0,
            loadedRate:Number(row.loaded_rate)||0,
            externalCost:Number(row.external_cost)||0,
            capex:Number(row.capex)||0,
            uncertainty:Number(row.uncertainty)||1,
            fte:Number(row.fte)||1,
            allocation:Number(row.allocation)||0.6,
            grossMargin:Number(row.gross_margin)||0,
            annualSavings:Number(row.annual_savings)||0,
            year1Revenue:Number(row.year1_revenue)||0,
            year2Revenue:Number(row.year2_revenue)||0,
            year3Revenue:Number(row.year3_revenue)||0,
            projectType:row.project_type||'A',
            costAmount:Number(row.cost_amount)||1,
            quadrantScore:Number(row.quadrant_score)||2,
            impact:Number(row.impact)||0,
            lift:Number(row.lift)||0,
            strategic:Number(row.strategic)||0,
            customer:Number(row.customer)||0,
            speed:Number(row.speed)||0,
            feasibility:Number(row.feasibility)||0,
            confidence:Number(row.confidence)||0,
            technicalRisk:Number(row.technical_risk)||1,
            productionRisk:Number(row.production_risk)||1,
            marketRisk:Number(row.market_risk)||1,
            unitSalesScore:Number(sales.unit_sales_score)||1,
            projectedUnits:Number(sales.projected_units)||0,
            averageSellingPrice:Number(sales.average_selling_price ?? row.price_lift)||0,
            recurringRevenueScore:Number(sales.recurring_revenue_score)||1,
            connectedRate:Number(sales.connected_rate)||0.10,
            monthlyRecurringBase:Number(sales.monthly_recurring_base)||0,
            speedToMarketScore:Number(sales.speed_to_market_score)||3,
            monthsToMarket:Number(sales.months_to_market)||2,
            priceLift:Number(sales.annual_price_lift)||0,
            improvesConversion:!!sales.improves_conversion,
            unlocksKits:!!sales.unlocks_kits,
            extendsProductLife:!!sales.extends_product_life,
            increasesConnectRate:!!sales.increases_connect_rate,
            unlocksRecurring:!!sales.unlocks_recurring,
            stabilizesBilling:!!sales.stabilizes_billing,
            deployableCurrentPlatform:!!sales.deployable_current_platform,
            salesCanActEarly:!!sales.sales_can_act_early,
            salesEvidence:sales.sales_evidence||'',
            recurringEvidence:sales.recurring_evidence||'',
            speedEvidence:sales.speed_evidence||'',
            useCalculatedSales:!!sales.use_calculated_sales
          },
          assignments:Array.isArray(row.assignments)?row.assignments.map(a=>({resourceId:a.resourceId||a.resource_id,hours:Number(a.hours??a.estimated_hours)||0,allocation:Number(a.allocation)||0,role:a.role||'',department:a.department||'',startMonth:String(a.startMonth||a.start_month||'').slice(0,7),finishMonth:String(a.finishMonth||a.finish_month||'').slice(0,7)})):[]
        };
      });
      const resources=(resourceResult.data||[]).map(row=>({
        id:row.id,name:row.name,role:row.role||'',department:row.department||'',
        loadedRate:Number(row.loaded_rate)||0,hoursPerMonth:Number(row.hours_per_month)||0
      }));
      return {projects,resources,salesTableAvailable:!salesResult.error};
    }
    async saveProject(project){
      const db=this.requireClient();
      const i=project.input||{};
      let result=await db.from('projects').upsert({
        id:project.id,name:project.name,description:project.description||'',division:project.division||'',
        category:project.category||'',status:project.status||'Proposed',champion:project.champion||'Unassigned',
        executive_sponsor:project.sponsor||null,start_date:project.startDate?`${project.startDate}-01`:null,
        updated_at:new Date().toISOString()
      });
      if(result.error) throw result.error;
      const operations=[
        db.from('project_estimates').upsert({project_id:project.id,hours:i.hours||0,loaded_rate:i.loadedRate||0,external_cost:i.externalCost||0,capex:i.capex||0,uncertainty:i.uncertainty||1,fte:i.fte||1,allocation:i.allocation||0,gross_margin:i.grossMargin||0,annual_savings:i.annualSavings||0,year1_revenue:i.year1Revenue||0,year2_revenue:i.year2Revenue||0,year3_revenue:i.year3Revenue||0}),
        db.from('project_scores').upsert({project_id:project.id,project_type:i.projectType||'A',cost_amount:i.costAmount||1,quadrant_score:i.quadrantScore||2,impact:i.impact||0,lift:i.lift||0,strategic:i.strategic||0,customer:i.customer||0,speed:i.speed||0,feasibility:i.feasibility||0,confidence:i.confidence||0,technical_risk:i.technicalRisk||1,production_risk:i.productionRisk||1,market_risk:i.marketRisk||1}),
        db.from('project_assignments').delete().eq('project_id',project.id),
        db.from('project_sales_marketing').upsert({
          project_id:project.id,unit_sales_score:i.unitSalesScore||1,projected_units:i.projectedUnits||0,
          average_selling_price:Number(i.averageSellingPrice)||0,recurring_revenue_score:i.recurringRevenueScore||1,
          connected_rate:Number(i.connectedRate)||0.10,monthly_recurring_base:Number(i.monthlyRecurringBase)||0,
          speed_to_market_score:i.speedToMarketScore||3,months_to_market:i.monthsToMarket||2,
          annual_price_lift:Number(i.priceLift)||0,improves_conversion:!!i.improvesConversion,
          unlocks_kits:!!i.unlocksKits,extends_product_life:!!i.extendsProductLife,
          increases_connect_rate:!!i.increasesConnectRate,unlocks_recurring:!!i.unlocksRecurring,
          stabilizes_billing:!!i.stabilizesBilling,deployable_current_platform:!!i.deployableCurrentPlatform,
          sales_can_act_early:!!i.salesCanActEarly,sales_evidence:i.salesEvidence||null,
          recurring_evidence:i.recurringEvidence||null,speed_evidence:i.speedEvidence||null,
          use_calculated_sales:!!i.useCalculatedSales,updated_at:new Date().toISOString()
        })
      ];
      const results=await Promise.all(operations);
      const failure=results.find(x=>x.error);
      if(failure) throw failure.error;
      if(project.assignments?.length){
        const assignmentResult=await db.from('project_assignments').insert(project.assignments.map(a=>({project_id:project.id,resource_id:a.resourceId,estimated_hours:a.hours||0,allocation:a.allocation||0,assignment_role:a.role||null,start_month:a.startMonth?`${a.startMonth}-01`:null,finish_month:a.finishMonth?`${a.finishMonth}-01`:null})));
        if(assignmentResult.error) throw assignmentResult.error;
      }
      return project;
    }

    async saveResource(resource){
      const db=this.requireClient();
      const uuidPattern=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      const existingId=String(resource.id||'');
      const id=uuidPattern.test(existingId)
        ? existingId
        : (globalThis.crypto?.randomUUID?.() || `${Date.now().toString(16)}-${Math.random().toString(16).slice(2)}-4000-8000-${Math.random().toString(16).slice(2,14)}`);
      const payload={
        id,
        name:String(resource.name||'').trim(),
        role:String(resource.role||'').trim()||null,
        department:String(resource.department||'').trim()||null,
        loaded_rate:Number(resource.loadedRate)||0,
        hours_per_month:Number(resource.hoursPerMonth)||0,
        active:resource.active!==false
      };

      // Use an upsert keyed by the UUID and do not request a single-row
      // representation. This avoids PGRST116 when PostgREST returns no body.
      const result=await db.from('resources').upsert(payload,{onConflict:'id'});
      if(result.error) throw result.error;

      return {
        id,
        name:payload.name,
        role:payload.role||'',
        department:payload.department||'',
        loadedRate:payload.loaded_rate,
        hoursPerMonth:payload.hours_per_month,
        active:payload.active
      };
    }
    async deleteResource(id){
      const db=this.requireClient();
      const {error}=await db.from('resources').delete().eq('id',id);
      if(error) throw error;
      return true;
    }
    async bulkSaveResources(items){
      const saved=[];
      for(const item of items) saved.push(await this.saveResource(item));
      return saved;
    }
    async deleteProject(id){
      const db=this.requireClient();
      const {error}=await db.from('projects').delete().eq('id',id);
      if(error) throw error;
      return true;
    }
    async bulkImport(projects){
      for(const project of projects) await this.saveProject(project);
      return projects.length;
    }
  }
  window.ProjectRepository=new ProjectRepositoryService();
})();
