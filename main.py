import numpy as np
import matplotlib.pyplot as plt
import random
import math

CONST_SEED = 42

# randomising permutaiton table
def generate_permutation():
    rng = random.Random(CONST_SEED)
    perm = list(range(256))
    rng.shuffle(perm)
    return perm * 2  # duplicate for overflow handling

# fading function, used for smooth transitions
def fade(t):
    return t * t * t * (t * (t * 6 - 15) + 10)

# function to interpolate between 2 values
def lerp(t, a, b):
    return a + t * (b - a)

# selects a "random" direction, creates a direction vector of direction and offset vector
def grad(hash_val, x, y):
    direction = hash_val % 8

    # different gradient vectors
    if direction == 0:
        gx, gy = 1, 1
    elif direction == 1:
        gx, gy = 1, -1
    elif direction == 2:
        gx, gy = -1, 1
    elif direction == 3:
        gx, gy = -1, -1
    elif direction == 4:
        gx, gy = 1, 0
    elif direction == 5:
        gx, gy = -1, 0
    elif direction == 6:
        gx, gy = 0, 1
    elif direction == 7:
        gx, gy = 0, -1

    # dot product
    return gx * x + gy * y


# 2D perlin noise function
def perlin_noise_2d(x, y, permutation):
    # the grid cell coordinates
    grid_x = int(math.floor(x)) & 255
    grid_y = int(math.floor(y)) & 255

    # determines how a far a value is inside a cell
    frac_x = x - math.floor(x)
    frac_y = y - math.floor(y)

    # smoothes the value
    u = fade(frac_x)
    v = fade(frac_y)

    # create a hash with the permutation table
    corner1 = permutation[grid_x] + grid_y
    corner2 = permutation[grid_x + 1] + grid_y

    # calculate the gradient and interpolate
    lerp_x1 = lerp(u, grad(permutation[corner1], frac_x, frac_y),
                     grad(permutation[corner2], frac_x - 1, frac_y))
    lerp_x2 = lerp(u, grad(permutation[corner1 + 1], frac_x, frac_y - 1),
                     grad(permutation[corner2 + 1], frac_x - 1, frac_y - 1))

    # interpolates the value again, results in the perlin noise value
    noise_value = lerp(v, lerp_x1, lerp_x2)
    return noise_value

# generate a 2D noise image
def generate_noise_image(width, height, scale=50.0):
    permutation = generate_permutation()
    image = np.zeros((height, width))
    for y in range(height):
        for x in range(width):
            nx = x / scale
            ny = y / scale
            noise = perlin_noise_2d(nx, ny, permutation)
            image[y][x] = (noise + 1) / 2  # turn into value between 0 and 1
    return image

# create and display the image
noise_img = generate_noise_image(256, 256)
plt.imshow(noise_img, cmap='gray')
plt.axis('off')
plt.title("2D Perlin Noise")
plt.show()
