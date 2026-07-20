'''Job Class Defintion'''
class Job:

    def __init__(self, command):
        self.command = command
        job_type = command.get('type')
        self.type = job_type
        self.run_id = command.get('run_id')
        self.config = command.get('args')

    def __repr__(self):
        if self.type == 'run':
            return f'Job({self.run_id},{self.config})'
        elif self.type == 'stop':
            return f'stop({self.run_id})'
        else:
            return 'exit'
        
class JobError(Exception):
    """Exception raised when a job fails during execution."""
    pass
