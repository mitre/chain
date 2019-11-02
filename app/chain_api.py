import asyncio
import logging

from aiohttp import web
from aiohttp_jinja2 import template

from app.objects.c_agent import Agent
from app.objects.c_operation import Operation
from plugins.chain.app.chain_svc import ChainService


class ChainApi:

    def __init__(self, services):
        self.data_svc = services.get('data_svc')
        self.app_svc = services.get('app_svc')
        self.reporting_svc = services.get('reporting_svc')
        self.auth_svc = services.get('auth_svc')
        self.plugin_svc = services.get('plugin_svc')
        self.agent_svc = services.get('agent_svc')
        self.file_svc = services.get('file_svc')
        self.chain_svc = ChainService(services)
        self.loop = asyncio.get_event_loop()

    @template('chain.html')
    async def landing(self, request):
        await self.auth_svc.check_permissions(request)
        try:
            abilities = await self.data_svc.locate('abilities')
            tactics = set([a.tactic.lower() for a in abilities])
            hosts = [h.display for h in await self.data_svc.locate('agents')]
            groups = list(set(([h['group'] for h in hosts])))
            adversaries = [a.display for a in await self.data_svc.locate('adversaries')]
            operations = [o.display for o in await self.data_svc.locate('operations')]
            sources = [s.display for s in await self.data_svc.locate('sources')]
            planners = [p.display for p in await self.data_svc.locate('planners')]
            plugins = [dict(name=getattr(p, 'name'), address=getattr(p, 'address')) for p in self.app_svc.get_plugins()]
            return dict(exploits=[a.display for a in abilities], groups=groups, adversaries=adversaries, agents=hosts,
                        operations=operations, tactics=tactics, sources=sources, planners=planners, plugins=plugins)
        except Exception as e:
            logging.error('[!] landing: %s' % e)

    async def rest_full(self, request):
        base = await self.rest_core(request)
        base[0]['abilities'] = [a.display for a in await self.data_svc.locate('abilities')]
        return web.json_response(base)

    async def rest_api(self, request):
        base = await self.rest_core(request)
        return web.json_response(base)

    async def rest_core(self, request):
        """
        This function is under construction until all objects have been converted from SQL tables
        :param request:
        :return:
        """
        await self.auth_svc.check_permissions(request)
        try:
            data = dict(await request.json())
            index = data.pop('index')
            if request.method == 'DELETE':
                if index == 'agent':
                    await self.data_svc.remove('agents', data)
                return 'Delete action completed'

            if request.method == 'PUT':
                if index == 'operation':
                    name = data.pop('name')
                    planner = await self.data_svc.locate('planners', match=dict(name=data.pop('planner')))
                    adversary = await self.data_svc.locate('adversaries', match=dict(adversary_id=data.pop('adversary_id')))
                    agents = await self.data_svc.locate('agents', match=dict(group=data.pop('group')))
                    sources = await self.data_svc.locate('sources', match=dict(name=data.pop('source')))
                    operations = await self.data_svc.locate('operations')
                    o = await self.data_svc.store(
                        Operation(op_id=len(operations)+1, name=name, planner=planner[0], agents=agents, adversary=adversary[0],
                                  jitter=data.pop('jitter'), source=next(iter(sources), None), state=data.pop('state'),
                                  allow_untrusted=int(data.pop('allow_untrusted')), autonomous=int(data.pop('autonomous')))
                    )
                    self.loop.create_task(self.app_svc.run_operation(o))
                    return [o.display]
            if request.method == 'POST':
                if index == 'result':
                    link_id = data.pop('link_id')
                    for op in await self.data_svc.locate('operations'):
                        link = next((link for link in op.chain if link.id == link_id), None)
                        if link:
                            _, content = await self.file_svc.read_file(name='%s-%s-%s' % (op.id, op.name, link_id), location='data/results')
                            return dict(link=link.display, output=content.decode('utf-8'))
                elif index == 'operation_report':
                    op_id = data.pop('op_id')
                    op = (await self.data_svc.locate('operations', match=dict(name=op_id)))[0]
                    return op.report

            if request.method == 'PUT':
                if index == 'chain':
                    operation = data.pop('operation')
                    link_id = int(data.pop('link_id'))
                    for op in await self.data_svc.locate('operations', match=dict(name=operation)):
                        link = next((link for link in op.chain if link.id == link_id), None)
                        link.status = data.get('status')
                        if data.get('command'):
                            link.command = data.get('command')
                        return ''

            options = dict(
                PUT=dict(
                    adversary=lambda d: self.chain_svc.persist_adversary(**d),
                    agent=lambda d: self.data_svc.store(Agent(paw=d.pop('paw'), group=d.get('group'),
                                                              trusted=d.get('trusted'), sleep_min=d.get('sleep_min'),
                                                              sleep_max=d.get('sleep_max'))),
                ),
                POST=dict(
                    adversary=lambda d: self.data_svc.locate('adversaries', match=d),
                    ability=lambda d: self.data_svc.locate('abilities', match=d),
                    operation=lambda d: self.data_svc.locate('operations', match=d),
                    agent=lambda d: self.data_svc.locate('agents', match=d),
                )
            )
            output = await options[request.method][index](data)
            if index == 'operation':
                if request.method == 'POST':
                    output = [o.display for o in output]
            if index == 'agent':
                if request.method == 'PUT':
                    output = output.display
                elif request.method == 'POST':
                    output = [a.display for a in output]
            if index == 'adversary':
                if request.method == 'POST':
                    output = [a.display for a in output]
            if index == 'ability':
                if request.method == 'POST':
                    output = [a.display for a in output]
            return output
        except Exception as e:
            logging.error('[!] rest_core: %s' % e)

    async def rest_update_operation(self, request):
        name = request.match_info['operation_id']
        data = await request.json()
        operation = await self.data_svc.locate('operations', match=dict(name=name))
        operation[0].autonomous = data.get('autonomous')
        return web.Response()

    async def rest_state_control(self, request):
        body = await request.json()
        state = body.get('state')

        async def _validate_request():
            try:
                op = await self.data_svc.locate('operations', dict(name=body['name']))
                if not len(op):
                    raise web.HTTPNotFound
                elif op[0].state == op[0].states['FINISHED']:
                    raise web.HTTPBadRequest(body='This operation has already finished.')
                elif state not in op[0].states.values():
                    raise web.HTTPBadRequest(body='state must be one of {}'.format(op[0].states.values()))
            except Exception as e:
                print(e)

        await _validate_request()
        operation = await self.data_svc.locate('operations', match=dict(name=body['name']))
        operation[0].state = body.get('state')
        return web.Response()
