import lumina
try:
    from wandb_workspaces.reports.v1 import *
except ImportError:
    lumina.termerror('Failed to import wandb_workspaces.  To edit reports programmatically, please install it using `pip install wandb[workspaces]`.')
