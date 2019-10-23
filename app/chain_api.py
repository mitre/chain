import asyncio

from aiohttp import web
from aiohttp_jinja2 import template

from plugins.chain.app.chain_svc import ChainService


class ChainApi:

    def __init__(self, services):
        self.data_svc = services.get('data_svc')
        self.operation_svc = services.get('operation_svc')
        self.reporting_svc = services.get('reporting_svc')
        self.auth_svc = services.get('auth_svc')
        self.plugin_svc = services.get('plugin_svc')
        self.agent_svc = services.get('agent_svc')
        self.chain_svc = ChainService(services)
        self.loop = asyncio.get_event_loop()

    @template('chain.html')
    async def landing(self, request):
        await self.auth_svc.check_permissions(request)
        abilities = await self.data_svc.explode('ability')
        tactics = set([a['tactic'].lower() for a in abilities])
        hosts = await self.data_svc.explode('agent')
        groups = list(set(([h['host_group'] for h in hosts])))
        adversaries = await self.data_svc.explode('adversary')
        operations = await self.data_svc.explode('operation')
        sources = await self.data_svc.explode('source')
        planners = await self.data_svc.explode('planner')
        plugins = [dict(name=getattr(p, 'name'), address=getattr(p, 'address')) for p in self.plugin_svc.get_plugins()]
        return dict(exploits=abilities, groups=groups, adversaries=adversaries, agents=hosts, operations=operations,
                    tactics=tactics, sources=sources, planners=planners, plugins=plugins)

    async def rest_full(self, request):
        base = await self.rest_core(request)
        base[0]['abilities'] = await self.data_svc.explode('ability')
        return web.json_response(base)

    async def rest_api(self, request):
        base = await self.rest_core(request)
        return web.json_response(base)

    async def rest_core(self, request):
        await self.auth_svc.check_permissions(request)
        data = dict(await request.json())
        index = data.pop('index')
        if request.method == 'DELETE':
            await self.data_svc.delete(index, data)
            return 'Delete action completed'

        options = dict(
            PUT=dict(
                ability=lambda d: self.chain_svc.persist_ability(**d),
                adversary=lambda d: self.chain_svc.persist_adversary(**d),
                operation=lambda d: self.data_svc.save('operation', d),
                fact=lambda d: self.data_svc.save('fact', d),
                agent=lambda d: self.data_svc.update('agent', 'paw', d.pop('paw'), d),
                chain=lambda d: self.data_svc.update(index, **d)
            ),
            POST=dict(
                adversary=lambda d: self.data_svc.explode('adversary', criteria=d),
                ability=lambda d: self.data_svc.explode('ability', criteria=d),
                operation=lambda d: self.data_svc.explode('operation', criteria=d),
                agent=lambda d: self.data_svc.explode('agent', criteria=d),
                result=lambda d: self.data_svc.explode('result', criteria=d),
                operation_report=lambda d: self.reporting_svc.generate_operation_report(**d),
            )
        )
        output = await options[request.method][index](data)
        if request.method == 'PUT' and index == 'operation':
            self.loop.create_task(self.operation_svc.run(output))
        return output

    async def rest_update_operation(self, request):
        op_id = int(request.match_info['operation_id'])
        data = await request.json()
        await self.data_svc.update('operation', key='id', value=op_id, data=data)
        return web.Response()

    async def rest_state_control(self, request):
        body = await request.json()
        state = body.get('state')

        async def _validate_request():
            op = await self.data_svc.get('operation', dict(id=body['id']))
            if not len(op):
                raise web.HTTPNotFound
            elif op[0]['state'] == self.operation_svc.op_states['FINISHED']:
                raise web.HTTPBadRequest(body='This operation has already finished.')
            elif state not in self.operation_svc.op_states.values():
                raise web.HTTPBadRequest(body='state must be one of {}'.format(self.operation_svc.op_states.values()))

        await _validate_request()
        await self.data_svc.update('operation', 'id', body['id'], dict(state=body.get('state')))
        return web.Response()

    async def rest_reset_trust(self, request):
        await self.auth_svc.check_permissions(request)
        data = dict(await request.json())
        await self.agent_svc.update_trust(paw=data['paw'], trusted=data['trusted'])
        return web.Response()
