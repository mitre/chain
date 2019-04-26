import asyncio

from aiohttp import web
from aiohttp_jinja2 import template


class ChainApi:

    def __init__(self, data_svc, operation_svc):
        self.data_svc = data_svc
        self.operation_svc = operation_svc
        self.loop = asyncio.get_event_loop()

    @template('chain.html')
    async def landing(self, request):
        abilities = await self.data_svc.explode_abilities()
        tactics = {a['technique']['tactic'] for a in abilities}
        for ab in abilities:
            ab.pop('cleanup')
        groups = await self.data_svc.explode_groups()
        hosts = await self.data_svc.dao.get('core_agent')
        parsers = await self.data_svc.dao.get('core_parser')
        adversaries = await self.data_svc.explode_adversaries()
        operations = await self.data_svc.dao.get('core_operation')
        return dict(exploits=abilities, groups=groups, adversaries=adversaries, hosts=hosts, operations=operations,
                    tactics=tactics, parsers=parsers)

    async def rest_api(self, request):
        data = dict(await request.json())
        index = data.pop('index')
        options = dict(
            PUT=dict(
                core_group=lambda d: self.data_svc.create_group(**d),
                core_adversary=lambda d: self.data_svc.create_adversary(**d),
                core_ability=lambda d: self.data_svc.create_ability(**d),
                core_operation=lambda d: self.data_svc.create_operation(**d)
            ),
            POST=dict(
                core_adversary=lambda d: self.data_svc.explode_adversaries(criteria=d),
                core_ability=lambda d: self.data_svc.explode_abilities(criteria=d),
                core_operation=lambda d: self.data_svc.explode_operation(criteria=d),
                core_agent=lambda d: self.data_svc.explode_agents(criteria=d),
                core_group=lambda d: self.data_svc.explode_groups(criteria=d),
                core_result=lambda d: self.data_svc.explode_results(criteria=d),
            )
        )
        output = await options[request.method][index](data)
        if request.method == 'PUT' and index == 'core_operation':
            self.loop.create_task(self.operation_svc.run(output))
            output = 'Started new operation #%s' % output
        return web.json_response(output)
