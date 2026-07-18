from __future__ import annotations
import asyncio
import functools
import inspect
import logging
from collections.abc import Sequence
from typing import Any, Protocol, TypeVar
import lumina.sdk
import lumina.util
from lumina.sdk.lib import telemetry as wb_telemetry
from lumina.sdk.lib.timer import Timer
logger = logging.getLogger(__name__)
AutologInitArgs = dict[str, Any] | None
K = TypeVar('K', bound=str)
V = TypeVar('V')

class Response(Protocol[K, V]):

    def __getitem__(self, key: K) -> V:
        ...

    def get(self, key: K, default: V | None=None) -> V | None:
        ...

class ArgumentResponseResolver(Protocol):

    def __call__(self, args: Sequence[Any], kwargs: dict[str, Any], response: Response, start_time: float, time_elapsed: float) -> dict[str, Any] | None:
        ...

class PatchAPI:

    def __init__(self, name: str, symbols: Sequence[str], resolver: ArgumentResponseResolver) -> None:
        """Patches the API to log wandb Media or metrics."""
        self.name = name
        self._api = None
        self.original_methods: dict[str, Any] = {}
        self.symbols = symbols
        self.resolver = resolver

    @property
    def set_api(self) -> Any:
        """Returns the API module."""
        lib_name = self.name.lower()
        if self._api is None:
            self._api = lumina.util.get_module(name=lib_name, required=f'To use the W&B {self.name} Autolog, you need to have the `{lib_name}` python package installed. Please install it with `pip install {lib_name}`.', lazy=False)
        return self._api

    def patch(self, run: wandb.Run) -> None:
        """Patches the API to log media or metrics to W&B."""
        for symbol in self.symbols:
            symbol_parts = symbol.split('.')
            original = functools.reduce(getattr, symbol_parts, self.set_api)

            def method_factory(original_method: Any):

                async def async_method(*args, **kwargs):
                    future = asyncio.Future()

                    async def callback(coro):
                        try:
                            result = await coro
                            loggable_dict = self.resolver(args, kwargs, result, timer.start_time, timer.elapsed)
                            if loggable_dict is not None:
                                run.log(loggable_dict)
                            future.set_result(result)
                        except Exception as e:
                            logger.warning(e)
                    with Timer() as timer:
                        coro = original_method(*args, **kwargs)
                        asyncio.ensure_future(callback(coro))
                    return await future

                def sync_method(*args, **kwargs):
                    with Timer() as timer:
                        result = original_method(*args, **kwargs)
                        try:
                            loggable_dict = self.resolver(args, kwargs, result, timer.start_time, timer.elapsed)
                            if loggable_dict is not None:
                                run.log(loggable_dict)
                        except Exception as e:
                            logger.warning(e)
                        return result
                if inspect.iscoroutinefunction(original_method):
                    return functools.wraps(original_method)(async_method)
                else:
                    return functools.wraps(original_method)(sync_method)
            self.original_methods[symbol] = original
            if len(symbol_parts) == 1:
                setattr(self.set_api, symbol_parts[0], method_factory(original))
            else:
                setattr(functools.reduce(getattr, symbol_parts[:-1], self.set_api), symbol_parts[-1], method_factory(original))

    def unpatch(self) -> None:
        """Unpatches the API."""
        for symbol, original in self.original_methods.items():
            symbol_parts = symbol.split('.')
            if len(symbol_parts) == 1:
                setattr(self.set_api, symbol_parts[0], original)
            else:
                setattr(functools.reduce(getattr, symbol_parts[:-1], self.set_api), symbol_parts[-1], original)

class AutologAPI:

    def __init__(self, name: str, symbols: Sequence[str], resolver: ArgumentResponseResolver, telemetry_feature: str | None=None) -> None:
        """Autolog API calls to W&B."""
        self._telemetry_feature = telemetry_feature
        self._patch_api = PatchAPI(name=name, symbols=symbols, resolver=resolver)
        self._name = self._patch_api.name
        self._run: lumina.Run | None = None
        self.__run_created_by_autolog: bool = False

    @property
    def _is_enabled(self) -> bool:
        """Returns whether autologging is enabled."""
        return self._run is not None

    def __call__(self, init: AutologInitArgs=None) -> None:
        """Enable autologging."""
        self.enable(init=init)

    def _run_init(self, init: AutologInitArgs=None) -> None:
        """Handle wandb run initialization."""
        if init:
            _wandb_run = lumina.run
            self._run = lumina.init(**init)
            if _wandb_run != self._run:
                self.__run_created_by_autolog = True
        elif lumina.run is None:
            self._run = lumina.init()
            self.__run_created_by_autolog = True
        else:
            self._run = lumina.run

    def enable(self, init: AutologInitArgs=None) -> None:
        """Enable autologging.

        Args:
            init: Optional dictionary of arguments to pass to wandb.init().

        """
        if self._is_enabled:
            logger.info(f'{self._name} autologging is already enabled, disabling and re-enabling.')
            self.disable()
        logger.info(f'Enabling {self._name} autologging.')
        self._run_init(init=init)
        self._patch_api.patch(self._run)
        if self._telemetry_feature:
            with wb_telemetry.context(self._run) as tel:
                setattr(tel.feature, self._telemetry_feature, True)

    def disable(self) -> None:
        """Disable autologging."""
        if self._run is None:
            return
        logger.info(f'Disabling {self._name} autologging.')
        if self.__run_created_by_autolog:
            self._run.finish()
            self.__run_created_by_autolog = False
        self._run = None
        self._patch_api.unpatch()
