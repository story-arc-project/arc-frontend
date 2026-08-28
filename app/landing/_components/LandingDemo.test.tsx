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
