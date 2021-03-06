import { get } from 'axios';
import sumBy from 'lodash/sumBy';
import { format } from 'd3-format';
import { format as formatDate } from 'date-fns';

import LineChart from 'components/charts/composed-chart';
import DynamicSentence from 'components/sentence';
import Widget from 'components/widget';

import styles from './styles.module.scss';

const rcpOptions = [
  {
    label: 'emissions stable by 2100',
    value: 'rcp4.5',
  },
  {
    label: 'business as usual',
    value: 'rcp8.5',
  },
];

const getData = async (params) => {
  const { data: historicalData } = await get(
    "https://cervest-science.carto.com/api/v2/sql?q=SELECT month, AVG(metric), STDDEV(metric) from hinc_signals WHERE scenario = 'historical' GROUP BY(month) ORDER BY(month)"
  );
  const { data: rcpData } = await get(
    `https://cervest-science.carto.com/api/v2/sql?q=SELECT month, AVG(metric), COUNT(metric) from hinc_signals WHERE year = ${params?.year} AND scenario = '${params?.scenario}' GROUP BY(month)`
  );

  return {
    historicalData: historicalData?.rows,
    rcpData: rcpData?.rows,
  };
};

const parseData = ({ historicalData, rcpData } = {}) => {
  const annualAvgTemp = sumBy(historicalData, 'avg') / 12;
  const annualAvgFutureTemp = sumBy(rcpData, 'avg') / 12;
  const chartData = historicalData?.map((d) => {
    const avg = d.avg - annualAvgTemp;

    return {
      ...d,
      avg,
      lowerStddev: avg - d.stddev,
      upperStddev: avg + d.stddev,
      rcp: rcpData?.find((r) => r.month === d.month)?.avg - annualAvgTemp,
    };
  });

  return {
    chartData,
    annualAvgTemp,
    annualAvgFutureTemp,
    statement: annualAvgFutureTemp > 0 ? 'warmer' : 'colder',
    tempChange: format('.1f')(annualAvgFutureTemp - annualAvgTemp),
  };
};

const WidgetAssetRisk = ({ params }) => (
  <Widget
    name="asset-risk"
    getData={getData}
    parseData={parseData}
    params={params}
  >
    {({ data }) => (
      <div>
        <div className={styles.wrapper}>
          <DynamicSentence
            className={styles.sentence}
            template="Temperatures in {{year}}, in a scenario of {{scenario}}, will be {{statement}} than historical records by an average of {{tempChange}}°C across your asset portfolio."
            params={{
              ...params,
              scenario: rcpOptions?.find((r) => r.value === params?.scenario)
                ?.label,
              statement: data?.statement,
              tempChange: data?.tempChange,
            }}
          />
          <LineChart
            className={styles.chart}
            data={data?.chartData}
            config={{
              lines: [
                {
                  dataKey: 'avg',
                  stroke: 'black',
                },
                {
                  dataKey: 'rcp',
                  stroke: 'red',
                },
              ],
              areas: [
                {
                  dataKey: 'lowerStddev',
                  fill: '#555555',
                  stroke: '#555555',
                  opacity: 0.2,
                  strokeWidth: 0,
                },
                {
                  dataKey: 'upperStddev',
                  fill: '#555555',
                  stroke: '#555555',
                  opacity: 0.2,
                  strokeWidth: 0,
                },
              ],
              xAxis: {
                dataKey: 'month',
                interval: 0,
                tickFormatter: (t) =>
                  formatDate(new Date(`2020-${t > 9 ? t : `0${t}`}-01`), 'MMM'),
                axisLine: false,
                tickLine: false,
              },
              yAxis: {
                tickFormatter: (t) => `${t}°C`,
                axisLine: false,
                tickLine: false,
              },
              xReference: `${params?.year}`,
            }}
          />
        </div>
      </div>
    )}
  </Widget>
);

export default WidgetAssetRisk;
