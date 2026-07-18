"""Chart Visualization Utilities

This module offers a collection of predefined chart types, along with functionality
for creating custom charts, enabling flexible visualization of your data beyond the
built-in options.
"""
__all__ = ['line', 'histogram', 'scatter', 'bar', 'roc_curve', 'pr_curve', 'confusion_matrix', 'line_series', 'plot_table', 'visualize']
from lumina.plot.bar import bar
from lumina.plot.confusion_matrix import confusion_matrix
from lumina.plot.custom_chart import CustomChart, plot_table
from lumina.plot.histogram import histogram
from lumina.plot.line import line
from lumina.plot.line_series import line_series
from lumina.plot.pr_curve import pr_curve
from lumina.plot.roc_curve import roc_curve
from lumina.plot.scatter import scatter
from lumina.plot.viz import Visualize, visualize
