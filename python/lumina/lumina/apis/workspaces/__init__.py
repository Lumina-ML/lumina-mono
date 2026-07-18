import lumina
try:
    from wandb_workspaces.workspaces import *
except ImportError:
    lumina.termerror('Failed to import wandb_workspaces. To edit workspaces programmatically, please install it using `pip install wandb[workspaces]`.')
