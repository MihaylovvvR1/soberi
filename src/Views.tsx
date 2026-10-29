import type { EventData, Expense } from './data'
import { expenseTotal, forecastUnknown, formatDate, money, totals } from './data'
import { Icon } from './Icons'
export { Overview } from './Overview'
export { PlanBuilder as Tasks } from './PlanBuilder'

function EventLine({ event }: { event: EventData }) { return <section className="compact-event"><div><span className="blue-dot" /><strong>{event.title}</strong></div><span><Icon name="calendar" size={16} />{formatDate(event.date)}</span></section> }

export function Budget({ event, editExpense, recordPayment }: { event: EventData; editExpense: (expense?: Expense) => void; recordPayment: (expense: Expense) => void }) {
  const budget = totals(event.expenses), overrun = Math.max(0, Math.round((budget.total - event.limit) * 100) / 100)
  return <div className="view budget-view">
    <EventLine event={event} />
    <div className="budget-stats" data-tour="budget-forecast">
      <section className="card budget-limit"><span className="stat-label">Лимит бюджета</span><strong>{money(event.limit)}</strong><span className="stat-footnote">Запланировали на мероприятие</span></section>
      <section className="card budget-total" data-testid="budget-total"><span className="stat-label">{budget.unknownCount ? 'Известная часть итога' : 'Ожидаемый итог'}</span><strong>{money(budget.total)}</strong><span className="stat-footnote">{budget.unknownCount ? 'Есть неизвестные суммы' : 'Без повторного учёта оплат'}</span></section>
      <section className={`card budget-overrun ${overrun ? 'has-overrun' : ''}`} data-testid="budget-overrun"><span className="stat-label">{overrun ? 'Превышение бюджета' : budget.unknownCount ? 'Остаток до уточнения' : 'Остаток бюджета'}</span><strong>{money(overrun || Math.round((event.limit - budget.total) * 100) / 100)}</strong><span className="stat-footnote">{overrun ? 'Нужно пересмотреть расходы' : budget.unknownCount ? 'Расходы могут вырасти' : 'Доступно для новых расходов'}</span></section>
    </div>
    {overrun > 0 && <div className="warning-banner"><Icon name="alert" size={19} /><div><strong>Ожидаемые расходы превышают лимит на {money(overrun)}</strong><p>Пересмотрите статьи расходов до мероприятия.</p></div></div>}
    {budget.unknownCount > 0 && <div className="warning-banner"><Icon name="info" size={19} /><div><strong>Итог неполный: не все суммы известны</strong><p>Уточните пустые суммы в {budget.unknownCount} статьях. Неизвестная стоимость не считается нулём.</p></div></div>}
    <section className="card expense-card">
      <div className="section-card-header expense-header"><div><h2>Статьи расходов</h2><p>План — ориентир. Ожидаемый итог считается по оплатам и предстоящим расходам.</p></div><button className="button primary small" onClick={() => editExpense()}><Icon name="plus" size={16} />Добавить расход</button></div>
      <div className="expense-table-wrap"><table className="expense-table"><thead><tr><th scope="col">Статья расходов</th><th scope="col">План</th><th scope="col">Оплачено</th><th scope="col">Остаток обязательств</th><th scope="col">Ожидается дополнительно</th><th scope="col">Итого</th><th scope="col"><span className="sr-only">Действия</span></th></tr></thead>
        <tbody>{event.expenses.map(expense => <tr key={expense.id} data-testid="expense-row">
          <td><button className="expense-name" onClick={() => editExpense(expense)}><strong>{expense.title}</strong><span>{expense.category}{expense.required ? ' · Обязательная' : ''}</span></button></td>
          <td data-label="План" className={expense.plan === null ? 'unknown-amount' : ''}>{money(expense.plan)}</td>
          <td data-label="Оплачено">{money(expense.paid)}</td>
          <td data-label="Остаток обязательств" className={expense.agreed === null ? 'unknown-amount' : ''}>{money(expense.agreed)}</td>
          <td data-label="Ожидается дополнительно" className={expense.expected === null ? 'unknown-amount' : ''}>{money(expense.expected)}</td>
          <td data-label="Итого" className="expense-row-total">{forecastUnknown(expense) ? 'От ' : ''}{money(expenseTotal(expense))}</td>
          <td className="expense-actions"><button className="icon-button" aria-label={`Изменить расход: ${expense.title}`} onClick={() => editExpense(expense)}><Icon name="edit" size={16} /></button><button className="icon-button" aria-label={`Отметить оплату: ${expense.title}`} disabled={expense.agreed === null || expense.agreed <= 0} title={expense.agreed === null ? 'Сначала уточните остаток обязательств' : expense.agreed > 0 ? 'Перенести сумму из обязательств в оплачено' : 'Нет остатка обязательств'} onClick={() => recordPayment(expense)}><Icon name="wallet" size={16} /></button></td>
        </tr>)}</tbody>
        <tfoot><tr><td>Всего{budget.unknownCount ? ' · известные суммы' : ''}</td><td data-label="План">{money(budget.plan)}</td><td data-label="Оплачено">{money(budget.paid)}</td><td data-label="Остаток обязательств">{money(budget.agreed)}</td><td data-label="Ожидается дополнительно">{money(budget.expected)}</td><td data-label="Итого">{money(budget.total)}</td><td /></tr></tfoot>
      </table></div>
      {!event.expenses.length && <div className="empty-state"><Icon name="wallet" size={30} /><h3>Начните с первой статьи расходов</h3><p>Добавьте площадку, работу команды или материалы.</p></div>}
    </section>
    <div className="budget-explainer"><div><span className="legend-dot legend-paid" /><div><strong>Оплачено</strong><p>Уже потраченные деньги.</p><b>{money(budget.paid)}</b></div></div><div><span className="legend-dot legend-agreed" /><div><strong>Остаток обязательств</strong><p>Осталось оплатить за согласованное.</p><b>{money(budget.agreed)}</b></div></div><div><span className="legend-dot legend-expected" /><div><strong>Ожидается дополнительно</strong><p>Будущие расходы сверх договорённостей.</p><b>{money(budget.expected)}</b></div></div></div>
    <div className="form-note"><Icon name="return" size={18} /><span>Ожидаемый итог = оплачено + остаток обязательств + дополнительные расходы. «Отметить оплату» переносит сумму между первыми двумя колонками, сохраняя итог. План в эту сумму не добавляется.</span></div>
  </div>
}
