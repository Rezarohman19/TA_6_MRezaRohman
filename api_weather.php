<?php
header("Content-Type: application/json; charset=utf-8");

$API_KEY = "643ae18e7f9c206f3a0a08db33f3ec2a"; 
$FAV_FILE = __DIR__ . '/favorites.json';

if(!file_exists($FAV_FILE)){
    file_put_contents($FAV_FILE, json_encode(["favorites"=>[]], JSON_PRETTY_PRINT));
}

function call_api($url){
    
    if(function_exists('curl_version')){
        $ch = curl_init($url);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_TIMEOUT, 12);
        $res = curl_exec($ch);
        $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);
        if($res === false) {
            http_response_code(502);
            echo json_encode(["error"=>"gateway"]);
            exit;
        }
        http_response_code($code);
        echo $res;
        exit;
    } else {
        $res = @file_get_contents($url);
        if($res === false){
            http_response_code(502);
            echo json_encode(["error"=>"gateway"]);
            exit;
        }
        echo $res;
        exit;
    }
}

$action = $_GET['action'] ?? $_POST['action'] ?? '';

if($action === 'geocode'){
    $q = $_GET['q'] ?? '';
    $limit = intval($_GET['limit'] ?? 5);
    $q_enc = urlencode($q);
    $url = "http://api.openweathermap.org/geo/1.0/direct?q={$q_enc}&limit={$limit}&appid={$API_KEY}";
    call_api($url);
}

if($action === 'current'){
    $city = urlencode($_GET['city'] ?? '');
    $unit = $_GET['unit'] ?? 'metric';
    $url = "https://api.openweathermap.org/data/2.5/weather?q={$city}&units={$unit}&appid={$API_KEY}";
    call_api($url);
}

if($action === 'forecast'){
    $city = urlencode($_GET['city'] ?? '');
    $unit = $_GET['unit'] ?? 'metric';
    $url = "https://api.openweathermap.org/data/2.5/forecast?q={$city}&units={$unit}&appid={$API_KEY}";
    call_api($url);
}

if($action === 'current_by_coords'){
    $lat = $_GET['lat'] ?? '';
    $lon = $_GET['lon'] ?? '';
    $unit = $_GET['unit'] ?? 'metric';
    $url = "https://api.openweathermap.org/data/2.5/weather?lat={$lat}&lon={$lon}&units={$unit}&appid={$API_KEY}";
    call_api($url);
}

if($action === 'forecast_by_coords'){
    $lat = $_GET['lat'] ?? '';
    $lon = $_GET['lon'] ?? '';
    $unit = $_GET['unit'] ?? 'metric';
    $url = "https://api.openweathermap.org/data/2.5/forecast?lat={$lat}&lon={$lon}&units={$unit}&appid={$API_KEY}";
    call_api($url);
}

if($action === 'favorite_list'){
    $json = json_decode(file_get_contents($FAV_FILE), true);
    if(!$json) $json = ["favorites"=>[]];
    echo json_encode($json);
    exit;
}

if($action === 'favorite_add'){
    $body = json_decode(file_get_contents('php://input'), true);
    $city = trim($body['city'] ?? '');
    if($city === ''){
        http_response_code(400);
        echo json_encode(["error"=>"empty city"]);
        exit;
    }
    $json = json_decode(file_get_contents($FAV_FILE), true);
    if(!$json) $json = ["favorites"=>[]];
    if(!in_array($city, $json['favorites'])){
        $json['favorites'][] = $city;
        file_put_contents($FAV_FILE, json_encode($json, JSON_PRETTY_PRINT|JSON_UNESCAPED_UNICODE));
    }
    echo json_encode(["success"=>true,"favorites"=>$json['favorites']]);
    exit;
}

if($action === 'favorite_remove'){
    $body = json_decode(file_get_contents('php://input'), true);
    $city = trim($body['city'] ?? '');
    $json = json_decode(file_get_contents($FAV_FILE), true);
    if(!$json) $json = ["favorites"=>[]];
    $json['favorites'] = array_values(array_filter($json['favorites'], function($c) use ($city){ return $c !== $city; }));
    file_put_contents($FAV_FILE, json_encode($json, JSON_PRETTY_PRINT|JSON_UNESCAPED_UNICODE));
    echo json_encode(["success"=>true,"favorites"=>$json['favorites']]);
    exit;
}

http_response_code(400);
echo json_encode(["error"=>"invalid action"]);
exit;
