import asyncio
import yaml

from collections import defaultdict

from app.objects.c_agent import Agent
from app.objects.c_operation import Operation


class ChainService:

    def __init__(self, services):
        self.services = services
        self.app_svc = services.get('app_svc')
        self.data_svc = services.get('data_svc')
        self.file_svc = services.get('file_svc')
        self.loop = asyncio.get_event_loop()

    async def persist_adversary(self, data):
        """
        Save a new adversary from either the GUI or REST API. This writes a new YML file into the core data/ directory.
        :param data:
        :return: the ID of the created adversary
        """
        i = data.pop('i')
        _, file_path = await self.services.get('file_svc').find_file_path('%s.yml' % i, location='data')
        if not file_path:
            file_path = 'data/adversaries/%s.yml' % i
        with open(file_path, 'w+') as f:
            f.seek(0)
            p = defaultdict(list)
            for ability in data.get('phases'):
                p[ability['phase']].append(ability['id'])
            f.write(yaml.dump(dict(id=i, name=data.pop('name'), description=data.pop('description'), phases=dict(p))))
            f.truncate()
        await self.data_svc.load_data('data')

    async def delete_agent(self, data):
        await self.data_svc.remove('agents', data)
        return 'Delete action completed'

    async def display_objects(self, object_name, data):
        return [o.display for o in await self.data_svc.locate(object_name, match=data)]

    async def display_result(self, data):
        link_id = data.pop('link_id')
        link = await self.app_svc.find_link(link_id)
        if link:
            _, content = await self.file_svc.read_file(name='%s' % link_id, location='data/results')
            return dict(link=link.display, output=content.decode('utf-8'))
        return ''

    async def display_operation_report(self, data):
        op_id = data.pop('op_id')
        op = (await self.data_svc.locate('operations', match=dict(name=op_id)))[0]
        return op.report

    async def update_agent_data(self, data):
        agent = await self.data_svc.store(Agent(paw=data.pop('paw'), group=data.get('group'),
                                                trusted=data.get('trusted'),
                                                sleep_min=data.get('sleep_min'),
                                                sleep_max=data.get('sleep_max')))
        return agent.display

    async def update_chain_data(self, data):
        link = await self.app_svc.find_link(data.pop('link_id'))
        link.status = data.get('status')
        if data.get('command'):
            link.command = data.get('command')
        return ''

    async def create_operation(self, data):
        name = data.pop('name')
        planner = await self.data_svc.locate('planners', match=dict(name=data.pop('planner')))
        adversary = await self.data_svc.locate('adversaries', match=dict(adversary_id=data.pop('adversary_id')))
        agents = await self.data_svc.locate('agents', match=dict(group=data.pop('group')))
        sources = await self.data_svc.locate('sources', match=dict(name=data.pop('source')))
        operations = await self.data_svc.locate('operations')
        o = await self.data_svc.store(
            Operation(op_id=len(operations) + 1, name=name, planner=planner[0], agents=agents, adversary=adversary[0],
                      jitter=data.pop('jitter'), source=next(iter(sources), None), state=data.pop('state'),
                      allow_untrusted=int(data.pop('allow_untrusted')), autonomous=int(data.pop('autonomous')))
        )
        self.loop.create_task(self.app_svc.run_operation(o))
        return [o.display]
