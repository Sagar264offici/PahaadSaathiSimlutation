import { useThree } from '@react-three/fiber'
import { useEffect } from 'react'

import { sceneCamera } from './sceneCamera'

export function SceneCapture() {
  const get = useThree((state) => state.get)
  useEffect(() => {
    sceneCamera.capture = () => {
      const { gl, scene, camera } = get()
      gl.render(scene, camera)
      const image = document.createElement('canvas')
      image.width = 480
      image.height = Math.round(480 * gl.domElement.height / gl.domElement.width)
      const context = image.getContext('2d')
      if (!context) throw new Error('Capture unavailable')
      context.drawImage(gl.domElement, 0, 0, image.width, image.height)
      return image.toDataURL('image/jpeg', .82)
    }
    return () => { delete sceneCamera.capture }
  }, [get])
  return null
}
