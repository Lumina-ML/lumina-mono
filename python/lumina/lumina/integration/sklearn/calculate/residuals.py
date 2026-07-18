from warnings import simplefilter
from sklearn import model_selection
import lumina
from lumina.integration.sklearn import utils
simplefilter(action='ignore', category=FutureWarning)

def residuals(regressor, X, y):
    x_train, x_test, y_train, y_test = model_selection.train_test_split(X, y, test_size=0.2)
    regressor.fit(x_train, y_train)
    train_score_ = regressor.score(x_train, y_train)
    test_score_ = regressor.score(x_test, y_test)
    y_pred_train = regressor.predict(x_train)
    residuals_train = y_pred_train - y_train
    y_pred_test = regressor.predict(x_test)
    residuals_test = y_pred_test - y_test
    table = make_table(y_pred_train, residuals_train, y_pred_test, residuals_test, train_score_, test_score_)
    chart = lumina.visualize('wandb/residuals_plot/v1', table)
    return chart

def make_table(y_pred_train, residuals_train, y_pred_test, residuals_test, train_score_, test_score_):
    y_pred_column, dataset_column, residuals_column = ([], [], [])
    datapoints, max_datapoints_train = (0, 100)
    for pred, residual in zip(y_pred_train, residuals_train, strict=False):
        y_pred_column.append(pred)
        dataset_column.append('train')
        residuals_column.append(residual)
        datapoints += 1
        if utils.check_against_limit(datapoints, 'residuals', max_datapoints_train):
            break
    datapoints = 0
    for pred, residual in zip(y_pred_test, residuals_test, strict=False):
        y_pred_column.append(pred)
        dataset_column.append('test')
        residuals_column.append(residual)
        datapoints += 1
        if utils.check_against_limit(datapoints, 'residuals', max_datapoints_train):
            break
    columns = ['dataset', 'y_pred', 'residuals', 'train_score', 'test_score']
    data = [[dataset_column[i], y_pred_column[i], residuals_column[i], train_score_, test_score_] for i in range(len(y_pred_column))]
    table = lumina.Table(columns=columns, data=data)
    return table
