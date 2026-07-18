from enum import Enum
'\nCall run.alert() to generate an email or Slack notification programmatically.\n'

class AlertLevel(Enum):
    INFO = 'INFO'
    WARN = 'WARN'
    ERROR = 'ERROR'
