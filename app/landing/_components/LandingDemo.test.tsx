import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import LandingDemo from './LandingDemo'

// vitest globals:false — 컴포넌트 테스트는 cleanup 을 손으로 건다.
afterEach(cleanup)

// 이름을 정확히 맞춘다 — 부분 일치로 잡으면 시드 카드의 '카카오 UX 인턴십 삭제' 버튼까지 걸린다.
function chip(label: string) {
  return screen.getByRole('button', { name: label })
}

describe('LandingDemo 유형 칩', () => {
  it('유형을 바꾸면 묻는 항목이 실제로 바뀐다 (FRT-339)', async () => {
    const user = userEvent.setup()
    render(<LandingDemo />)

    // 인턴십(기본): 근무 형태를 묻는다
    expect(screen.getByLabelText('근무 형태')).toBeInTheDocument()
    expect(screen.queryByText('세부 작업')).not.toBeInTheDocument()

    await user.click(chip('프로젝트'))

    // 프로젝트: 근무 형태는 사라지고 세부 작업 표가 나온다
    expect(screen.queryByLabelText('근무 형태')).not.toBeInTheDocument()
    expect(screen.getByText('세부 작업')).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: '1번째 줄 작업' })).toBeInTheDocument()

    await user.click(chip('공모전·수상'))

    expect(screen.getByLabelText('수상 훈격')).toBeInTheDocument()
    expect(screen.queryByText('세부 작업')).not.toBeInTheDocument()
  })

  it('제목 라벨도 유형을 따라간다', async () => {
    const user = userEvent.setup()
    render(<LandingDemo />)

    expect(screen.getByLabelText('회사 / 직무')).toBeInTheDocument()

    await user.click(chip('프로젝트'))
    expect(screen.getByLabelText('프로젝트명')).toBeInTheDocument()

    await user.click(chip('공모전·수상'))
    expect(screen.getByLabelText('대회 / 프로그램명')).toBeInTheDocument()
  })

  it('선택 상태를 스크린리더에 알린다', async () => {
    const user = userEvent.setup()
    render(<LandingDemo />)

    expect(chip('인턴십')).toHaveAttribute('aria-pressed', 'true')
    expect(chip('프로젝트')).toHaveAttribute('aria-pressed', 'false')

    await user.click(chip('프로젝트'))
    expect(chip('프로젝트')).toHaveAttribute('aria-pressed', 'true')
    expect(chip('인턴십')).toHaveAttribute('aria-pressed', 'false')
  })

  it('유형을 바꿔도 적던 제목은 살아있다 — 잘못 눌렀다 되돌릴 수 있어야 한다', async () => {
    const user = userEvent.setup()
    render(<LandingDemo />)

    await user.type(screen.getByLabelText('회사 / 직무'), '카카오')
    await user.click(chip('프로젝트'))
    await user.click(chip('인턴십'))

    expect(screen.getByLabelText('회사 / 직무')).toHaveValue('카카오')
  })
})

describe('LandingDemo 가이드 문구', () => {
  it('필드마다 무엇을 적어야 하는지 안내한다 — 이 섹션의 요점이다', () => {
    render(<LandingDemo />)

    expect(screen.getByText('어디서 어떤 일을 했는지 적어주세요.')).toBeInTheDocument()
    expect(
      screen.getByText('내가 담당했던 업무나 개인적으로 이룬 성과를 적어주세요.')
    ).toBeInTheDocument()
  })

  it('안내문을 입력칸에 연결해 스크린리더가 함께 읽게 한다', () => {
    render(<LandingDemo />)

    const input = screen.getByLabelText('회사 / 직무')
    const describedBy = input.getAttribute('aria-describedby')
    expect(describedBy).toBeTruthy()
    expect(document.getElementById(describedBy as string)?.textContent).toBe(
      '어디서 어떤 일을 했는지 적어주세요.'
    )
  })

  it('표의 셀에도 안내문을 연결한다 — 설명은 조상에서 상속되지 않는다', async () => {
    const user = userEvent.setup()
    render(<LandingDemo />)

    await user.click(chip('프로젝트'))

    const cell = screen.getByRole('textbox', { name: '1번째 줄 작업' })
    const describedBy = cell.getAttribute('aria-describedby')
    expect(describedBy).toBeTruthy()
    expect(document.getElementById(describedBy as string)?.textContent).toBe(
      '프로젝트 안에서 내가 한 일을 작업 단위로 나눠 적어보세요. 줄을 늘릴 수 있어요.'
    )
  })

  it('유형마다 모든 입력칸이 안내문을 달고 있다 — 포맷이 늘어도 빠지지 않게', async () => {
    const user = userEvent.setup()
    render(<LandingDemo />)

    for (const type of ['인턴십', '프로젝트', '공모전·수상']) {
      await user.click(chip(type))
      await user.click(screen.getByRole('button', { name: /더 자세히 묻기/ }))

      const panel = within(screen.getByRole('tabpanel'))
      const controls = [...panel.getAllByRole('textbox'), ...panel.getAllByRole('combobox')]
      for (const control of controls) {
        const id = control.getAttribute('aria-describedby') ?? ''
        expect(
          document.getElementById(id)?.textContent,
          `${type} — ${control.getAttribute('aria-label') ?? id}`
        ).toBeTruthy()
      }
    }
  })
})

describe('LandingDemo 더 자세히 묻기', () => {
  it('접어둔 항목은 펼쳐야 나온다 — 볼륨을 묶되 깊이를 보여준다', async () => {
    const user = userEvent.setup()
    render(<LandingDemo />)

    expect(screen.queryByLabelText('사용한 스킬 / 툴 / 기술')).not.toBeInTheDocument()

    const toggle = screen.getByRole('button', { name: /더 자세히 묻기/ })
    expect(toggle).toHaveAttribute('aria-expanded', 'false')

    await user.click(toggle)

    expect(screen.getByLabelText('사용한 스킬 / 툴 / 기술')).toBeInTheDocument()
    expect(screen.getByLabelText('성장 / 변화')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /접기/ })).toHaveAttribute('aria-expanded', 'true')
  })

  it('유형을 바꾸면 접힘도 처음 상태로 돌아간다', async () => {
    const user = userEvent.setup()
    render(<LandingDemo />)

    await user.click(screen.getByRole('button', { name: /더 자세히 묻기/ }))
    expect(screen.getByLabelText('사용한 스킬 / 툴 / 기술')).toBeInTheDocument()

    await user.click(chip('프로젝트'))

    // 접힘은 볼륨을 묶는 장치다 — 유형이 바뀌면 다시 접혀야 한다.
    expect(screen.getByRole('button', { name: /더 자세히 묻기/ })).toHaveAttribute(
      'aria-expanded',
      'false'
    )
    expect(screen.queryByLabelText('개인 / 팀')).not.toBeInTheDocument()
  })

  it('접힘 필드를 채워둔 유형으로 돌아오면 펼친 채로 둔다', async () => {
    const user = userEvent.setup()
    render(<LandingDemo />)

    await user.click(screen.getByRole('button', { name: /더 자세히 묻기/ }))
    await user.type(screen.getByLabelText('사용한 스킬 / 툴 / 기술'), 'Figma{Enter}')

    await user.click(chip('프로젝트'))
    await user.click(chip('인턴십'))

    // 접으면 렌더에서 빠지는데 값은 카드에 실린다 — 안 보이는 값이 저장되면 안 된다.
    expect(screen.getByRole('button', { name: /접기/ })).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('button', { name: 'Figma 삭제' })).toBeInTheDocument()
  })
})

describe('LandingDemo 시드 카드', () => {
  it('유형마다 다른 시점 표기를 카드에 보여준다', () => {
    render(<LandingDemo />)

    // 인턴십은 기간, 수상은 날짜 — 유형이 다르면 카드에 실리는 것도 다르다.
    expect(screen.getByText('2024.07 — 2024.09')).toBeInTheDocument()
    expect(screen.getByText('2024.03.15')).toBeInTheDocument()
  })

  it('입력한 태그가 카드에도 보인다', () => {
    render(<LandingDemo />)

    expect(screen.getByText('Figma')).toBeInTheDocument()
  })
})

describe('LandingDemo 경험 추가', () => {
  it('제목과 요약을 채우면 카드가 목록에 붙는다', async () => {
    const user = userEvent.setup()
    render(<LandingDemo />)

    const addButton = screen.getByRole('button', { name: '경험 추가' })
    expect(addButton).toBeDisabled()

    await user.type(screen.getByLabelText('회사 / 직무'), '토스 프로덕트 인턴')
    await user.type(
      screen.getByLabelText('나의 담당 업무 / 주요 성과'),
      '송금 화면 사용성 개선을 담당했습니다'
    )

    expect(addButton).toBeEnabled()
    await user.click(addButton)

    const list = screen.getByText('기록된 경험').closest('div')?.parentElement
    expect(list).toBeTruthy()
    expect(within(list as HTMLElement).getByText('토스 프로덕트 인턴')).toBeInTheDocument()
    expect(screen.getByLabelText('회사 / 직무')).toHaveValue('')
  })

  it('다른 유형에서 적다 만 값은 카드로 따라가지 않는다', async () => {
    const user = userEvent.setup()
    render(<LandingDemo />)

    await user.click(chip('공모전·수상'))
    await user.type(screen.getByLabelText('수상 훈격'), '대상')

    await user.click(chip('프로젝트'))
    await user.type(screen.getByLabelText('프로젝트명'), '캠퍼스 앱')
    await user.type(screen.getByLabelText('핵심 성과'), '베타 출시')
    await user.click(screen.getByRole('button', { name: '경험 추가' }))

    expect(screen.queryByText('대상')).not.toBeInTheDocument()
  })
})
