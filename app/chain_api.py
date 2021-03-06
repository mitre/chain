import logging
import traceback

from aiohttp import web
from aiohttp_jinja2 import template

from plugins.chain.app.chain_svc import ChainService


class ChainApi:

    def __init__(self, services):
        self.data_svc = services.get('data_svc')
        self.app_svc = services.get('app_svc')
        self.reporting_svc = services.get('reporting_svc')
        self.auth_svc = services.get('auth_svc')
        self.plugin_svc = services.get('plugin_svc')
        self.file_svc = services.get('file_svc')
        self.chain_svc = ChainService(services)

    @template('chain.html')
    async def landing(self, request):
        await self.auth_svc.check_permissions(request)
        try:
            abilities = await self.data_svc.locate('abilities')
            tactics = set([a.tactic.lower() for a in abilities])
            payloads = set([a.payload for a in abilities if a.payload])
            hosts = [h.display for h in await self.data_svc.locate('agents')]
            groups = list(set(([h['group'] for h in hosts])))
            adversaries = [a.display for a in await self.data_svc.locate('adversaries')]
            operations = [o.display for o in await self.data_svc.locate('operations')]
            sources = [s.display for s in await self.data_svc.locate('sources')]
            planners = [p.display for p in await self.data_svc.locate('planners')]
            return dict(exploits=[a.display for a in abilities], groups=groups, adversaries=adversaries, agents=hosts,
                        operations=operations, tactics=tactics, sources=sources, planners=planners, payloads=payloads)
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
            options = dict(
                DELETE=dict(
                    agent=lambda d: self.chain_svc.delete_agent(d),
                ),
                PUT=dict(
                    adversary=lambda d: self.chain_svc.persist_adversary(d),
                    ability=lambda d: self.chain_svc.persist_ability(d),
                    agent=lambda d: self.chain_svc.update_agent_data(d),
                    chain=lambda d: self.chain_svc.update_chain_data(d),
                    operation=lambda d: self.chain_svc.create_operation(d),
                    schedule=lambda d: self.chain_svc.create_schedule(d),
                ),
                POST=dict(
                    ability=lambda d: self.chain_svc.display_objects('abilities', d),
                    adversary=lambda d: self.chain_svc.display_objects('adversaries', d),
                    agent=lambda d: self.chain_svc.display_objects('agents', d),
                    operation=lambda d: self.chain_svc.display_objects('operations', d),
                    operation_report=lambda d: self.chain_svc.display_operation_report(d),
                    result=lambda d: self.chain_svc.display_result(d),
                )
            )
            output = await options[request.method][index](data)
            return output
        except Exception:
            traceback.print_exc()

    async def rest_update_operation(self, request):
        i = request.match_info['operation_id']
        data = await request.json()
        operation = await self.data_svc.locate('operations', match=dict(id=int(i)))
        operation[0].autonomous = data.get('autonomous')
        return web.Response()

    async def rest_state_control(self, request):
        body = await request.json()
        state = body.get('state')

        async def _validate_request():
            try:
                op = await self.data_svc.locate('operations', dict(id=body['name']))
                if not len(op):
                    raise web.HTTPNotFound
                elif op[0].state == op[0].states['FINISHED']:
                    raise web.HTTPBadRequest(body='This operation has already finished.')
                elif state not in op[0].states.values():
                    raise web.HTTPBadRequest(body='state must be one of {}'.format(op[0].states.values()))
            except Exception as e:
                print(e)

        await _validate_request()
        operation = await self.data_svc.locate('operations', match=dict(id=body['name']))
        operation[0].state = body.get('state')
        return web.Response()
