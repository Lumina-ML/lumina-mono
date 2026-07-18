"""xgboost init!"""
from __future__ import annotations
import json
import warnings
from collections.abc import Callable
from pathlib import Path
from typing import TYPE_CHECKING, NamedTuple, TypeAlias, cast
import xgboost as xgb
import xgboost.callback
from typing_extensions import override
import lumina
from lumina.sdk.lib import telemetry as wb_telemetry
MINIMIZE_METRICS = ['rmse', 'rmsle', 'mae', 'mape', 'mphe', 'logloss', 'error', 'error@t', 'merror']
MAXIMIZE_METRICS = ['auc', 'aucpr', 'ndcg', 'map', 'ndcg@n', 'map@n']
if TYPE_CHECKING:

    class CallbackEnv(NamedTuple):
        evaluation_result_list: list
    _ScoreList = list[float] | list[tuple[float, float]]
    _EvalsLog: TypeAlias = dict[str, dict[str, _ScoreList]]

def wandb_callback() -> Callable:
    """Old style callback that will be deprecated in favor of WandbCallback. Please try the new logger for more features."""
    warnings.warn('wandb_callback will be deprecated in favor of WandbCallback. Please use WandbCallback for more features.', UserWarning, stacklevel=2)
    with wb_telemetry.context() as tel:
        tel.feature.xgboost_old_wandb_callback = True

    def callback(env: CallbackEnv) -> None:
        for k, v in env.evaluation_result_list:
            lumina.log({k: v}, commit=False)
        lumina.log({})
    return callback

class WandbCallback(xgboost.callback.TrainingCallback):
    """`WandbCallback` automatically integrates XGBoost with wandb.

    Args:
        log_model: (boolean) if True save and upload the model to Weights & Biases Artifacts
        log_feature_importance: (boolean) if True log a feature importance bar plot
        importance_type: (str) one of {weight, gain, cover, total_gain, total_cover} for tree model. weight for linear model.
        define_metric: (boolean) if True (default) capture model performance at the best step, instead of the last step, of training in your `wandb.summary`.

    Passing `WandbCallback` to XGBoost will:

    - log the booster model configuration to Weights & Biases
    - log evaluation metrics collected by XGBoost, such as rmse, accuracy etc. to Weights & Biases
    - log training metric collected by XGBoost (if you provide training data to eval_set)
    - log the best score and the best iteration
    - save and upload your trained model to Weights & Biases Artifacts (when `log_model = True`)
    - log feature importance plot when `log_feature_importance=True` (default).
    - Capture the best eval metric in `wandb.summary` when `define_metric=True` (default).

    Example:
        ```python
        bst_params = dict(
            objective="reg:squarederror",
            colsample_bytree=0.3,
            learning_rate=0.1,
            max_depth=5,
            alpha=10,
            n_estimators=10,
            tree_method="hist",
            callbacks=[WandbCallback()],
        )

        xg_reg = xgb.XGBRegressor(**bst_params)
        xg_reg.fit(
            X_train,
            y_train,
            eval_set=[(X_test, y_test)],
        )
        ```
    """

    def __init__(self, log_model: bool=False, log_feature_importance: bool=True, importance_type: str='gain', define_metric: bool=True):
        super().__init__()
        self.log_model: bool = log_model
        self.log_feature_importance: bool = log_feature_importance
        self.importance_type: str = importance_type
        self.define_metric: bool = define_metric
        if lumina.run is None:
            raise lumina.Error('You must call wandb.init() before WandbCallback()')
        with wb_telemetry.context() as tel:
            tel.feature.xgboost_wandb_callback = True

    @override
    def before_training(self, model: xgb.Booster) -> xgb.Booster:
        """Run before training is finished."""
        config = model.save_config()
        lumina.config.update(json.loads(config))
        return model

    @override
    def after_training(self, model: xgb.Booster) -> xgb.Booster:
        """Run after training is finished."""
        if self.log_model:
            self._log_model_as_artifact(model)
        if self.log_feature_importance:
            self._log_feature_importance(model)
        if model.attr('best_score') is not None:
            lumina.log({'best_score': float(cast(str, model.attr('best_score'))), 'best_iteration': int(cast(str, model.attr('best_iteration')))})
        return model

    @override
    def after_iteration(self, model: xgb.Booster, epoch: int, evals_log: _EvalsLog) -> bool:
        """Run after each iteration. Return True when training should stop."""
        for data, metric in evals_log.items():
            for metric_name, log in metric.items():
                if self.define_metric:
                    self._define_metric(data, metric_name)
                    lumina.log({f'{data}-{metric_name}': log[-1]}, commit=False)
                else:
                    lumina.log({f'{data}-{metric_name}': log[-1]}, commit=False)
        lumina.log({'epoch': epoch})
        self.define_metric = False
        return False

    def _log_model_as_artifact(self, model: xgb.Booster) -> None:
        model_name = f'{lumina.run.id}_model.json'
        model_path = Path(lumina.run.dir) / model_name
        model.save_model(str(model_path))
        model_artifact = lumina.Artifact(name=model_name, type='model')
        model_artifact.add_file(str(model_path))
        lumina.log_artifact(model_artifact)

    def _log_feature_importance(self, model: xgb.Booster) -> None:
        fi = model.get_score(importance_type=self.importance_type)
        fi_data = [[k, fi[k]] for k in fi]
        table = lumina.Table(data=fi_data, columns=['Feature', 'Importance'])
        lumina.log({'Feature Importance': lumina.plot.bar(table, 'Feature', 'Importance', title='Feature Importance')})

    def _define_metric(self, data: str, metric_name: str) -> None:
        if 'loss' in str.lower(metric_name):
            lumina.define_metric(f'{data}-{metric_name}', summary='min')
        elif str.lower(metric_name) in MINIMIZE_METRICS:
            lumina.define_metric(f'{data}-{metric_name}', summary='min')
        elif str.lower(metric_name) in MAXIMIZE_METRICS:
            lumina.define_metric(f'{data}-{metric_name}', summary='max')
        else:
            pass
