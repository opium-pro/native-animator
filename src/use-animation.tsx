import * as React from 'react'
import { useRef, useEffect } from 'react'
import { PanResponder, Dimensions, Animated, Easing } from 'react-native'

const window = Dimensions.get("window")

export const useAnimation = ({
  minDistanceToFinish = 40,
  maxDistanceToFinish = 200 as any,
  percentageToFinish = 80,
  trackDirections = ['bottom'],
  initialDirection = trackDirections[0],
  deceleration = 3,
  duration = 300,
  maxLuft = 50,
  active = true,
  velocityToFinish = 1.75,
  onSetValue = (value: any): any => value,
  onMove = (...args: any): any => true,
  onRelease = (...args: any): any => true,
  onFinish = undefined as unknown as (direction?: string, finishedAmount?: number) => void | boolean | Function,
  onReadyToFinish = (): void => undefined,
  detachHandlers = false,
  lockDimension = false,
  isVertical = trackDirections.includes('top') || trackDirections.includes('bottom'),
  isHorisontal = trackDirections.includes('right') || trackDirections.includes('left'),
}) => {
  if (typeof maxDistanceToFinish === 'number') {
    maxDistanceToFinish = {
      top: maxDistanceToFinish,
      right: maxDistanceToFinish,
      bottom: maxDistanceToFinish,
      left: maxDistanceToFinish,
    }
  }
  const valueToHide = {
    x: ['right', 'left'].includes(initialDirection) ? window.width : 0,
    y: ['top', 'bottom'].includes(initialDirection) ? window.height : 0,
  }
  if (initialDirection === 'top') { valueToHide.y = -valueToHide.y }
  if (initialDirection === 'left') { valueToHide.x = -valueToHide.x }

  const getValueToHide: any = () => {
    const shiftX = animatedElement.x._value
    const shiftY = animatedElement.y._value

    if (Math.abs(shiftX) > Math.abs(shiftY)) {
      if (isHorisontal) {
        valueToHide.y = 0
        valueToHide.x = shiftX < 0 ? -window.width : window.width
      }
    } else if (Math.abs(shiftX) < Math.abs(shiftY)) {
      if (isVertical) {
        valueToHide.x = 0
        valueToHide.y = shiftY < 0 ? -window.height : window.height
      }
    }

    return valueToHide
  }

  const animatedElement: any = useRef(new Animated.ValueXY(valueToHide)).current

  function handleFinish(direction?: string, force?: boolean) {
    return new Promise((res, rej) => {
      if (!force && !trackDirections?.length) {
        moveToInitial()
        return rej()
      }

      if (typeof direction !== 'string') {
        direction = initialDirection
      }
      Animated.timing(animatedElement, {
        toValue: getValueToHide(),
        duration,
        useNativeDriver: false,
        easing: Easing.ease,
      }).start(() => {
        moveToInitial()
        return res(onFinish instanceof Function ? onFinish(direction) : onFinish)
      })
    })
  }

  function moveToInitial() {
    active && Animated.timing(animatedElement, {
      toValue: 0,
      duration,
      useNativeDriver: false,
      easing: Easing.ease,
    }).start(() => {
      onMove({ dy: 0, dx: 0, vy: 0, vx: 0 }, countFinished({ dy: 0, dx: 0 }))
    })
  }

  function applyLuft(value) {
    if (deceleration && Math.abs(value) / deceleration <= maxLuft) {
      return value / deceleration
    } else if (deceleration) {
      return undefined
    }
    return 0
  }

  let vibrated: boolean = false
  function countFinished({ dy, dx }) {
    const current = {
      top: dy < 0 ? Math.abs(dy) : 0,
      bottom: dy > 0 ? Math.abs(dy) : 0,
      left: dx < 0 ? Math.abs(dx) : 0,
      right: dx > 0 ? Math.abs(dx) : 0,
    }
    const match = [0]
    for (const key in maxDistanceToFinish) {
      if (trackDirections.includes(key)) {
        match.push(current[key] / maxDistanceToFinish[key])
      }
    }
    const finished = Math.max(...match)
    if (finished >= 1) {
      if (!vibrated) {
        onReadyToFinish?.()
        vibrated = true
      }
    } else {
      vibrated = false
    }
    return finished
  }

  let moveIsLocked: any = false
  function handleMove({ dy, dx, vy, vx }) {
    if (onMove({ dy, dx, vy, vx }, countFinished({ dy, dx })) === false) {
      return
    }

    if (isVertical && isHorisontal && lockDimension && !moveIsLocked) {
      if (Math.abs(dy) > Math.abs(dx)) {
        moveIsLocked = 'vertical'
      } else {
        moveIsLocked = 'horizontal'
      }
    }

    if (!isVertical || moveIsLocked === 'horizontal') {
      dy = 0
    } else if (
      (!trackDirections.includes('top') && dy < 0)
      ||
      (!trackDirections.includes('bottom') && dy > 0)
    ) {
      dy = applyLuft(dy) || animatedElement.y._value
    }

    if (!isHorisontal || moveIsLocked === 'vertical') {
      dx = 0
    } else if (
      (!trackDirections.includes('left') && dx < 0)
      ||
      (!trackDirections.includes('right') && dx > 0)
    ) {
      dx = applyLuft(dx) || animatedElement.x._value
    }

    const result = { x: dx, y: dy }
    animatedElement.setValue(onSetValue(result))
    return result
  }

  function handleRelease({ dx, dy, vx, vy }) {
    const finishedAmount = countFinished({ dy, dx })
    if (onRelease({ dx, dy, vy, vx }, finishedAmount) === false) {
      return
    }

    moveIsLocked = false
    let distance, velocity, directionToFinish

    if (isVertical) {
      distance = dy
      velocity = vy
      directionToFinish = dy < 0 ? 'top' : 'bottom'
    }

    if (isHorisontal && Math.abs(dx) > Math.abs(dy)) {
      distance = dx
      velocity = vx
      directionToFinish = dx < 0 ? 'left' : 'right'
    }

    if (finishedAmount > 1) {
      return handleFinish(directionToFinish)
    }

    // if (Math.abs(distance) > maxDistanceToFinish[directionToFinish]) {
    //   if (trackDirections.includes(directionToFinish)) {
    //     return handleFinish(directionToFinish)
    //   }
    // }

    if (velocity > velocityToFinish && Math.abs(distance) > minDistanceToFinish) {
      if (trackDirections.includes(directionToFinish)) {
        return handleFinish(directionToFinish)
      }
    }

    return moveToInitial()
  }

  const { panHandlers: handlers } = useRef(PanResponder.create({
    onMoveShouldSetPanResponder: () => active,
    onPanResponderTerminationRequest: () => false,
    onPanResponderMove: (evt, { dy, dx, vy, vx }) => handleMove({ dy, dx, vy, vx }),
    onPanResponderRelease: (evt, { dx, dy, vy, vx }) => handleRelease({ dx, dy, vy, vx }),
  })).current

  useEffect(() => {
    moveToInitial()
  }, [])

  function setMaxDistanceToFinish(event) {
    if (percentageToFinish) {
      const { height, width } = event.nativeEvent.layout
      const newMaxDistance = {
        top: height * percentageToFinish / 100,
        bottom: height * percentageToFinish / 100,
        right: width * percentageToFinish / 100,
        left: width * percentageToFinish / 100,
      }

      for (const key in maxDistanceToFinish) {
        if (newMaxDistance[key] < maxDistanceToFinish[key] && newMaxDistance[key] > minDistanceToFinish) {
          maxDistanceToFinish[key] = newMaxDistance[key]
        }
      }
    }
  }

  function contentLayout(event) {
    setMaxDistanceToFinish(event)
  }

  const Animate = ({ children, disabled = false, style = {}, ...rest }: any) => {
    const newHandlers = detachHandlers ? {} : handlers
    const { x, y } = animatedElement
    const transform: any = [
      { translateY: y },
      { translateX: x },
    ]
    if (disabled) {
      return children
    }
    return (
      <Animated.View
        {...rest}
        {...newHandlers}
        onLayout={setMaxDistanceToFinish}
        style={{...style, transform: transform}}
      >
        {children}
      </Animated.View>
    )
  }

  return {
    handleFinish,
    Animate,
    handlers,
    contentLayout,
    handleRelease,
    handleMove,
  }
}