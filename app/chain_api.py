import asyncio
import logging

from aiohttp import web
from aiohttp_jinja2 import template

from app.objects.c_agent import Agent
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
        self.file_svc = services.get('file_svc')
        self.loop = asyncio.get_event_loop()

    @template('chain.html')
    async def landing(self, request):
        await self.auth_svc.check_permissions(request)
        try:
            abilities = await self.data_svc.explode('ability')
            tactics = set([a['tactic'].lower() for a in abilities])
            hosts = [h.display for h in await self.data_svc.locate('agents')]
            groups = list(set(([h['group'] for h in hosts])))
            adversaries = await self.data_svc.explode('adversary')
            operations = await self.data_svc.explode('operation')
            sources = await self.data_svc.explode('source')
            planners = [p.display for p in await self.data_svc.locate('planners')]
            payloads = await self.file_svc.find_payloads()
            plugins = [dict(name=getattr(p, 'name'), address=getattr(p, 'address')) for p in self.plugin_svc.get_plugins()]
            return dict(exploits=abilities, groups=groups, adversaries=adversaries, agents=hosts, operations=operations,
                        tactics=tactics, sources=sources, planners=planners, plugins=plugins, payloads=payloads)
        except Exception as e:
            logging.debug('[!] landing: %s' % e)

    async def rest_full(self, request):
        base = await self.rest_core(request)
        base[0]['abilities'] = await self.data_svc.explode('ability')
        return web.json_response(base)

    async def rest_api(self, request):
        base = await self.rest_core(request)
        return web.json_response(base)

    async def rest_core(self, request):
        await self.auth_svc.check_permissions(request)
        try:
            data = dict(await request.json())
            index = data.pop('index')
            if request.method == 'DELETE':
                if index == 'agent':
                    await self.data_svc.remove('agents', data)
                else:
                    await self.data_svc.delete(index, data)
                return 'Delete action completed'

            options = dict(
                PUT=dict(
                    ability=lambda d: self.chain_svc.persist_ability(**d),
                    adversary=lambda d: self.chain_svc.persist_adversary(**d),
                    operation=lambda d: self.data_svc.save('operation', d),
                    fact=lambda d: self.data_svc.save('fact', d),
                    agent=lambda d: self.data_svc.store(Agent(paw=d.pop('paw'), group=d.get('group'),
                                                              trusted=d.get('trusted'), sleep_min=d.get('sleep_min'),
                                                              sleep_max=d.get('sleep_max'))),
                    chain=lambda d: self.data_svc.update(index, **d)
                ),
                POST=dict(
                    adversary=lambda d: self.data_svc.explode('adversary', criteria=d),
                    ability=lambda d: self.data_svc.explode('ability', criteria=d),
                    operation=lambda d: self.data_svc.explode('operation', criteria=d),
                    agent=lambda d: self.data_svc.locate('agents', match=d),
                    result=lambda d: self.data_svc.explode('result', criteria=d),
                    operation_report=lambda d: self.reporting_svc.generate_operation_report(**d),
                    payloads=lambda d: self.file_svc.save_file(**d),
                )
            )
            output = await options[request.method][index](data)
            if index == 'operation':
                if request.method == 'PUT':
                    self.loop.create_task(self.operation_svc.run(output))
                elif request.method == 'POST':
                    for op in output:
                        op['host_group'] = [a.display for a in op['host_group']]
            if index == 'agent':
                if request.method == 'PUT':
                    output = output.display
                elif request.method == 'POST':
                    output = [a.display for a in output]
            return output
        except Exception as e:
            logging.debug('[!] rest_core: %s' % e)

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
