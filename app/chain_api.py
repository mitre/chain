import asyncio

from aiohttp import web
from aiohttp_jinja2 import template


class ChainApi:

    def __init__(self, services):
        self.data_svc = services.get('data_svc')
        self.operation_svc = services.get('operation_svc')
        self.auth_svc = services.get('auth_svc')
        self.loop = asyncio.get_event_loop()

    @template('chain.html')
    async def landing(self, request):
        await self.auth_svc.check_permissions(request)
        abilities = await self.data_svc.explode_abilities()
        tactics = {a['technique']['tactic'] for a in abilities}
        groups = await self.data_svc.explode_groups()
        hosts = await self.data_svc.dao.get('core_agent')
        parsers = await self.data_svc.dao.get('core_parser')
        adversaries = await self.data_svc.explode_adversaries()
        operations = await self.data_svc.dao.get('core_operation')
        sources = await self.data_svc.explode_sources()
        return dict(exploits=abilities, groups=groups, adversaries=adversaries, hosts=hosts, operations=operations,
                    tactics=tactics, parsers=parsers, sources=sources)

    async def rest_api(self, request):
        await self.auth_svc.check_permissions(request)
        data = dict(await request.json())
        index = data.pop('index')
        options = dict(
            PUT=dict(
                core_group=lambda d: self.data_svc.create_group(**d),
                core_adversary=lambda d: self.data_svc.create_adversary(**d),
                core_ability=lambda d: self.data_svc.create_ability(**d),
                core_operation=lambda d: self.data_svc.create_operation(**d),
                core_fact=lambda d: self.data_svc.create_fact(**d)
            ),
            POST=dict(
                core_adversary=lambda d: self.data_svc.explode_adversaries(criteria=d),
                core_ability=lambda d: self.data_svc.explode_abilities(criteria=d),
                core_operation=lambda d: self.data_svc.explode_operation(criteria=d),
                core_agent=lambda d: self.data_svc.explode_agents(criteria=d),
                core_group=lambda d: self.data_svc.explode_groups(criteria=d),
                core_result=lambda d: self.data_svc.explode_results(criteria=d),
            ),
            DELETE=dict(
                core_fact=lambda d: self.data_svc.delete(index, **d)
            )
        )
        output = await options[request.method][index](data)
        if request.method == 'PUT' and index == 'core_operation':
            self.loop.create_task(self.operation_svc.run(output))
        return web.json_response(output)
