import asyncio

from aiohttp import web
from aiohttp_jinja2 import template


class ChainApi:

    def __init__(self, services):
        self.data_svc = services.get('data_svc')
        self.operation_svc = services.get('operation_svc')
        self.auth_svc = services.get('auth_svc')
        self.plugin_svc = services.get('plugin_svc')
        self.loop = asyncio.get_event_loop()

    @template('chain.html')
    async def landing(self, request):
        await self.auth_svc.check_permissions(request)
        abilities = await self.data_svc.explode_abilities()
        tactics = set([tactic for sublist in [eval(a['technique']['tactic']) for a in abilities] for tactic in sublist])
        hosts = await self.data_svc.explode_agents()
        groups = list(set(([h['host_group'] for h in hosts])))
        adversaries = await self.data_svc.explode_adversaries()
        operations = await self.data_svc.explode_operation()
        sources = await self.data_svc.explode_sources()
        planners = await self.data_svc.explode_planners()
        plugins = [dict(name=getattr(p, 'name'), address=getattr(p, 'address')) for p in self.plugin_svc.get_plugins()]
        return dict(exploits=abilities, groups=groups, adversaries=adversaries, agents=hosts, operations=operations,
                    tactics=tactics, sources=sources, planners=planners, plugins=plugins)

    async def rest_full(self, request):
        base = await self.rest_core(request)
        base[0]['abilities'] = await self.data_svc.explode_abilities()
        return web.json_response(base)

    async def rest_api(self, request):
        base = await self.rest_core(request)
        return web.json_response(base)

    async def rest_core(self, request):
        await self.auth_svc.check_permissions(request)
        data = dict(await request.json())
        index = data.pop('index')
        if request.method == 'DELETE':
            return await self.data_svc.delete(index, **data)

        options = dict(
            PUT=dict(
                core_adversary=lambda d: self.data_svc.persist_adversary(**d),
                core_ability=lambda d: self.data_svc.create_ability(**d),
                core_operation=lambda d: self.data_svc.create_operation(**d),
                core_fact=lambda d: self.data_svc.create_fact(**d),
                core_agent=lambda d: self.data_svc.update('core_agent', 'paw', d.pop('paw'), d)
            ),
            POST=dict(
                core_adversary=lambda d: self.data_svc.explode_adversaries(criteria=d),
                core_ability=lambda d: self.data_svc.explode_abilities(criteria=d),
                core_operation=lambda d: self.data_svc.explode_operation(criteria=d),
                core_agent=lambda d: self.data_svc.explode_agents(criteria=d),
                core_result=lambda d: self.data_svc.explode_results(criteria=d),
            ),
        )
        output = await options[request.method][index](data)
        if request.method == 'PUT' and index == 'core_operation':
            self.loop.create_task(self.operation_svc.run(output))
        return output

    async def rest_state_control(self, request):
        body = await request.json()
        state = body.get('state')

        async def _validate_request():
            op = await self.data_svc.dao.get('core_operation', dict(id=body['id']))
            if not len(op):
                raise web.HTTPNotFound
            elif op[0]['state'] == self.operation_svc.op_states['FINISHED']:
                raise web.HTTPBadRequest(body='This operation has already finished.')
            elif state not in self.operation_svc.op_states.values():
                raise web.HTTPBadRequest(body='state must be one of {}'.format(self.operation_svc.op_states.values()))

        await _validate_request()
        await self.data_svc.update('core_operation', 'id', body['id'], dict(state=body.get('state')))
        return web.Response()
